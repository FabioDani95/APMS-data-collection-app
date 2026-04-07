import { getStudyConfig, getTaskDefinition, resolveText, resolveTextList } from "@/lib/config";
import type { Locale, ToolCode } from "@/lib/types";
import { demographicsSchema, toolSchema } from "@/lib/validation";
import { z } from "zod";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

const generatedTaskSchema = z.object({
  task_order: z.number().int().min(1).max(3),
  diagnosis_text: z.string().trim().min(1).max(5000),
  corrective_action_text: z.string().trim().min(1).max(5000),
  confidence_score: z.number().int().min(1).max(7),
  trust_t1: z.number().int().min(1).max(7),
  trust_t2: z.number().int().min(1).max(7),
  trust_t3: z.number().int().min(1).max(7),
  time_spent_seconds: z.number().int().min(30).max(300),
  timed_out: z.boolean(),
});

const generatedPostSessionSchema = z
  .object({
    rank_1: toolSchema,
    rank_2: toolSchema,
    rank_3: toolSchema,
    rank_justification: z.string().trim().min(1).max(5000),
    open_comment: z.string().trim().min(1).max(5000),
  })
  .refine((data) => new Set([data.rank_1, data.rank_2, data.rank_3]).size === 3, {
    message: "Post-session rankings must be unique.",
    path: ["rank_3"],
  });

const generatedSyntheticSessionSchema = z.object({
  demographics: demographicsSchema,
  tasks: z.array(generatedTaskSchema).length(3),
  post_session: generatedPostSessionSchema,
});

export type GeneratedSyntheticSession = z.infer<typeof generatedSyntheticSessionSchema>;

interface SyntheticParticipantGuidance {
  participant_name?: string | null;
  age?: number | null;
  gender?: "male" | "female" | null;
  study_profile_hint?: string | null;
  exp_3d_printing?: "none" | "basic" | "intermediate" | "advanced" | null;
  conf_troubleshooting?: number | null;
  fam_manufacturing?: number | null;
  preferred_tool?: ToolCode | null;
  least_preferred_tool?: ToolCode | null;
  answer_verbosity_percent?: number;
  decisiveness_percent?: number;
  tool_trust_percent?: number;
  notes?: string | null;
}

const fallbackNames = {
  en: {
    first: ["Alex", "Jordan", "Taylor", "Morgan", "Casey"],
    last: ["Smith", "Turner", "Walker", "Taylor", "Johnson"],
  },
  it: {
    first: ["Luca", "Giulia", "Marco", "Sara", "Davide"],
    last: ["Rossi", "Bianchi", "Conti", "Romano", "Esposito"],
  },
} as const;

function hashString(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function ensureFullName(value: string, locale: Locale) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  const fallback = fallbackNames[locale];
  const seed = cleaned || locale;
  const first = fallback.first[hashString(seed) % fallback.first.length];
  const last = fallback.last[hashString(`${seed}-last`) % fallback.last.length];

  if (tokens.length >= 2) {
    return cleaned;
  }

  if (tokens.length === 1) {
    return `${tokens[0]} ${last}`;
  }

  return `${first} ${last}`;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string) {
  const aTokens = new Set(normalizeText(a).split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(normalizeText(b).split(" ").filter((token) => token.length > 2));

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function assertDistinctTaskResponses(tasks: GeneratedSyntheticSession["tasks"]) {
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const a = tasks[i];
      const b = tasks[j];
      const diagnosisSimilarity = jaccardSimilarity(a.diagnosis_text, b.diagnosis_text);
      const actionSimilarity = jaccardSimilarity(a.corrective_action_text, b.corrective_action_text);
      const exactDiagnosis = normalizeText(a.diagnosis_text) === normalizeText(b.diagnosis_text);
      const exactAction = normalizeText(a.corrective_action_text) === normalizeText(b.corrective_action_text);

      if (exactDiagnosis || exactAction || diagnosisSimilarity > 0.8 || actionSimilarity > 0.8) {
        throw new Error("Generated task responses are too similar across scenarios.");
      }
    }
  }
}

function buildConstrainedRanking(
  rankedTools: ToolCode[],
  allTools: ToolCode[],
  preferredTool?: ToolCode | null,
  leastPreferredTool?: ToolCode | null,
) {
  const uniqueRankedTools = rankedTools.filter(
    (tool, index, array): tool is ToolCode => allTools.includes(tool) && array.indexOf(tool) === index,
  );
  const completedRanking = [...uniqueRankedTools];

  for (const tool of allTools) {
    if (!completedRanking.includes(tool)) {
      completedRanking.push(tool);
    }
  }

  let constrainedRanking = completedRanking;

  if (preferredTool) {
    constrainedRanking = [preferredTool, ...constrainedRanking.filter((tool) => tool !== preferredTool)];
  }

  if (leastPreferredTool) {
    constrainedRanking = [...constrainedRanking.filter((tool) => tool !== leastPreferredTool), leastPreferredTool];
  }

  return constrainedRanking.slice(0, 3);
}

function getSystemPrompt(locale: Locale) {
  if (locale === "it") {
    return [
      "Sei un ricercatore esperto che genera dati sintetici ad alta fedeltà per uno studio sperimentale su strumenti di supporto al troubleshooting di stampanti 3D industriali.",
      "Devi restituire solo JSON valido, senza markdown, senza testo introduttivo e senza commenti.",
      "",
      "GERARCHIA DI PRESTAZIONI PER STRUMENTO:",
      "I tre strumenti hanno capacità diverse che si riflettono nelle risposte dei partecipanti in modo statistico (non deterministico):",
      "- KG (Knowledge Graph): fornisce risposte precise, tracciate e strutturate per causa-effetto. Un utente attento può seguirle correttamente. Tendenzialmente produce le diagnosi più accurate.",
      "- DOC (Documentazione): richiede navigazione di fonti non strutturate. I partecipanti trovano spesso solo informazioni parziali o devono incrociare più pagine. Produce diagnosi di qualità intermedia.",
      "- LLM (Chatbot AI): dà risposte sicure di sé ma a volte errate o incomplete. Porta facilmente i partecipanti fuori strada. Produce mediamente le diagnosi meno accurate — ma circa il 30% dei partecipanti si fida ugualmente di risposte sbagliate (effetto allucinazione).",
      "",
      "PERSONALITÀ DEL PARTECIPANTE:",
      "I campi answer_verbosity_percent, decisiveness_percent, tool_trust_percent, notes e study_profile_hint devono essere visibili nel testo delle risposte:",
      "- Bassa decisiveness → frasi hedged: 'penso che forse il problema potrebbe essere...', 'non sono sicuro ma...'",
      "- Alta verbosity → risposte lunghe, ridondanti, con passaggi ripetuti",
      "- Bassa tool_trust → disclaimer espliciti: 'lo strumento suggeriva X ma non ne sono convinto perché...'",
      "- study_profile_hint e notes → influenzano lessico e ragionamento (es. uno studente di ingegneria meccanica usa termini tecnici precisi; uno di management è più vago)",
      "",
      "REALISMO TEMPORALE:",
      "- Scenario facile + KG: 60-150 secondi",
      "- Scenario medio + DOC: 150-280 secondi",
      "- Scenario difficile + LLM: spesso vicino al timeout di 300 secondi",
      "- Se timed_out è true: il testo di diagnosi deve sembrare troncato a metà frase, come se il partecipante stesse ancora scrivendo",
      "",
      "QUALITÀ E RUMORE DEL TESTO:",
      "- Introduci 1-2 errori di battitura per risposta (non in ogni parola, solo occasionali)",
      "- Alcune risposte identificano il componente giusto ma propongono la correzione sbagliata",
      "- Alcune risposte diagnosticano correttamente una sola causa su due nel caso di problemi multi-causa",
      "- Alcune risposte copiano verbatim il messaggio di errore senza aggiungere interpretazione",
      "- Se il partecipante è italiano, usa un mix naturale di italiano e inglese tecnico (es. 'il nozzle è clogged', 'ho controllato il bed leveling')",
      "",
      "REALISMO DEI PUNTEGGI LIKERT:",
      "- Trust scores (T1, T2, T3) correlano con la qualità della risposta dello strumento in quel task, non sono uniformemente medi",
      "- KG corretto in 90 secondi → trust alto (5-7); LLM sbagliato → trust basso (2-4) oppure alto nonostante l'errore (30% dei casi LLM)",
      "- Confidence_score correla con decisiveness e inversamente con il tempo impiegato",
      "- Non generare tutti i valori Likert come 4 o 5",
      "",
      "RANKING POST-SESSIONE:",
      "- Il ranking deve riflettere l'esperienza concreta del partecipante nei tre task",
      "- rank_justification deve citare aspetti specifici dell'esperienza ('il KG mi ha dato una risposta diretta', 'la wiki ci ho perso 10 minuti senza trovare niente di utile')",
      "",
      "DATI DEMOGRAFICI:",
      "- Nomi realistici italiani o internazionali (studio in università italiana)",
      "- age: intero plausibile tra 18 e 99",
      "- gender: solo 'male' oppure 'female'",
      "- study_profile: combinare titolo e profilo di studio/lavoro in un solo campo, ad esempio 'Magistrale in Ingegneria Meccanica', 'Dottorando in Ingegneria Industriale', 'Tecnico di laboratorio'",
      "- exp_3d_printing: prevalentemente 'none' o 'basic' (criterio di inclusione dello studio: nessuna esperienza con questa macchina specifica)",
    ].join("\n");
  }

  return [
    "You are an expert researcher generating high-fidelity synthetic data for an experimental study on troubleshooting support tools for industrial 3D printers.",
    "Return valid JSON only, with no markdown, no preamble, and no comments.",
    "",
    "TOOL PERFORMANCE HIERARCHY:",
    "The three tools have different capabilities that shape participant responses statistically (not deterministically):",
    "- KG (Knowledge Graph): provides precise, traceable, cause-effect structured answers. A careful user can follow them correctly. Tends to produce the most accurate diagnoses.",
    "- DOC (Documentation): requires navigating unstructured sources. Participants often find only partial information or must cross-reference multiple pages. Produces intermediate-quality diagnoses.",
    "- LLM (AI Chatbot): gives confident but sometimes wrong or incomplete answers that lead users astray. Produces the least accurate diagnoses on average — but about 30% of participants trust wrong LLM answers anyway (hallucination effect).",
    "",
    "PARTICIPANT PERSONALITY:",
    "The fields answer_verbosity_percent, decisiveness_percent, tool_trust_percent, notes, and study_profile_hint must be visible in the response text:",
    "- Low decisiveness → hedged language: 'I think maybe the issue could be...', 'I'm not entirely sure but...'",
    "- High verbosity → long, redundant answers with repeated steps",
    "- Low tool_trust → explicit disclaimers: 'the tool suggested X but I'm not fully convinced because...'",
    "- study_profile_hint and notes → shape vocabulary and reasoning style (e.g. a mechanical engineering student uses precise technical terms; a management student is vaguer)",
    "",
    "TIME REALISM:",
    "- Easy scenario + KG: 60-150 seconds",
    "- Medium scenario + DOC: 150-280 seconds",
    "- Hard scenario + LLM: often near the 300-second timeout",
    "- If timed_out is true: the diagnosis text must trail off mid-sentence as if the participant was still typing when time ran out",
    "",
    "RESPONSE TEXT QUALITY AND NOISE:",
    "- Introduce 1-2 typos per response (occasional, not every word)",
    "- Some responses identify the right component but propose the wrong fix",
    "- Some responses correctly diagnose only one of two causes in multi-cause problems",
    "- Some responses copy the error message verbatim without adding interpretation",
    "- If the participant has an Italian background, use a natural mix of English and Italian technical terms (e.g. 'il nozzle is clogged', 'I checked the bed leveling')",
    "",
    "LIKERT SCORE REALISM:",
    "- Trust scores (T1, T2, T3) must loosely correlate with whether the tool gave a good answer in that specific task, not be uniformly mid-range",
    "- KG correct in 90 seconds → high trust (5-7); LLM wrong answer → low trust (2-4), or high trust despite being wrong (30% of LLM cases, hallucination effect)",
    "- confidence_score should correlate with decisiveness and inversely with time spent",
    "- Do not generate all Likert values as 4 or 5",
    "",
    "POST-SESSION RANKING:",
    "- The ranking must reflect the participant's concrete experience across the three tasks",
    "- rank_justification must reference specific aspects of that participant's experience ('the KG gave me a direct traceable answer', 'I spent ages in the wiki and couldn't find the right page')",
    "",
    "DEMOGRAPHIC REALISM:",
    "- Use realistic Italian or international names (study is at an Italian university)",
    "- age: plausible integer between 18 and 99",
    "- gender: only 'male' or 'female'",
    "- study_profile: combine title and study/work profile in a single field, for example 'MSc Mechanical Engineering', 'PhD candidate in Industrial Engineering', 'Lab technician'",
    "- exp_3d_printing: mostly 'none' or 'basic' (study inclusion criterion: no prior experience with this specific machine)",
  ].join("\n");
}

function buildUserPrompt(locale: Locale, groupId: string, guidance: SyntheticParticipantGuidance) {
  const config = getStudyConfig();
  const allTools = Object.keys(config.tools) as ToolCode[];
  const constrainedRanking = buildConstrainedRanking(
    allTools,
    allTools,
    guidance.preferred_tool ?? null,
    guidance.least_preferred_tool ?? null,
  );

  // Per-tool difficulty-aware time windows to guide generation
  function timeWindowHint(tool: ToolCode, difficulty: number): string {
    if (tool === "KG") {
      return difficulty <= 1
        ? locale === "it"
          ? "Tempo atteso: 60-120 secondi (scenario facile + KG preciso)"
          : "Expected time: 60-120 seconds (easy scenario + precise KG)"
        : difficulty <= 2
          ? locale === "it"
            ? "Tempo atteso: 90-180 secondi (scenario medio + KG)"
            : "Expected time: 90-180 seconds (medium scenario + KG)"
          : locale === "it"
            ? "Tempo atteso: 120-220 secondi (scenario difficile + KG)"
            : "Expected time: 120-220 seconds (hard scenario + KG)";
    }
    if (tool === "DOC") {
      return difficulty <= 1
        ? locale === "it"
          ? "Tempo atteso: 100-200 secondi (DOC richiede navigazione anche per scenari facili)"
          : "Expected time: 100-200 seconds (DOC requires navigation even on easy scenarios)"
        : difficulty <= 2
          ? locale === "it"
            ? "Tempo atteso: 150-280 secondi (scenario medio + DOC non strutturato)"
            : "Expected time: 150-280 seconds (medium scenario + unstructured DOC)"
          : locale === "it"
            ? "Tempo atteso: 200-300 secondi, probabile timeout (scenario difficile + DOC)"
            : "Expected time: 200-300 seconds, likely timeout (hard scenario + DOC)";
    }
    // LLM
    return difficulty <= 1
      ? locale === "it"
        ? "Tempo atteso: 80-160 secondi (scenario facile; LLM risponde in fretta ma va verificato)"
        : "Expected time: 80-160 seconds (easy scenario; LLM answers fast but needs checking)"
      : difficulty <= 2
        ? locale === "it"
          ? "Tempo atteso: 140-260 secondi (scenario medio + LLM a volte fuorviante)"
          : "Expected time: 140-260 seconds (medium scenario + potentially misleading LLM)"
        : locale === "it"
          ? "Tempo atteso: 220-300 secondi, spesso timeout (scenario difficile + LLM impreciso)"
          : "Expected time: 220-300 seconds, often timeout (hard scenario + imprecise LLM)";
  }

  // Per-tool accuracy guidance for the model
  function accuracyHint(tool: ToolCode): string {
    if (tool === "KG") {
      return locale === "it"
        ? "Il KG per questo task fornisce una risposta precisa e tracciabile. Il partecipante può seguirla correttamente se è attento. Alta probabilità di diagnosi corretta."
        : "The KG for this task provides a precise, traceable answer. The participant can follow it correctly if attentive. High probability of correct diagnosis.";
    }
    if (tool === "DOC") {
      return locale === "it"
        ? "La documentazione per questo task è dispersa su più pagine. Il partecipante trova probabilmente solo informazioni parziali. Diagnosi di qualità variabile: può essere corretta ma incompleta, oppure errata per mancanza di contesto."
        : "The documentation for this task is scattered across multiple pages. The participant likely finds only partial information. Diagnosis quality is variable: may be correct but incomplete, or wrong due to missing context.";
    }
    // LLM
    return locale === "it"
      ? "Il chatbot per questo task risponde con sicurezza ma con rischio concreto di errori o omissioni. ~70% dei casi: diagnosi errata o incompleta. ~30% dei casi: il partecipante si fida di una risposta sbagliata (effetto allucinazione) e scrive con alta confidenza. Decidi quale caso si applica in base alla personalità e ai vincoli."
      : "The chatbot for this task answers confidently but with real risk of errors or omissions. ~70% of cases: wrong or incomplete diagnosis. ~30% of cases: participant trusts a wrong answer (hallucination effect) and writes with high confidence. Decide which case applies based on personality and constraints.";
  }

  const taskPlan = [1, 2, 3].map((taskOrder) => {
    const definition = getTaskDefinition(groupId, taskOrder);
    if (!definition) {
      throw new Error(`Missing task definition for ${groupId} task ${taskOrder}.`);
    }

    const scenario = config.scenarios[definition.scenario];

    return {
      task_order: taskOrder,
      scenario_id: definition.scenario,
      tool_assigned: definition.tool,
      tool_label: resolveText(config.tools[definition.tool].label, locale),
      tool_usage_steps: config.instructions.tools[definition.tool].usage_steps[locale],
      tool_you_may: config.instructions.tools[definition.tool].you_may[locale],
      tool_you_may_not: config.instructions.tools[definition.tool].you_may_not[locale],
      accuracy_hint: accuracyHint(definition.tool),
      time_hint: timeWindowHint(definition.tool, scenario.difficulty),
      writing_style_hint:
        definition.tool === "KG"
          ? locale === "it"
            ? "Stile KG: risposta strutturata per causa-effetto, lessico tecnico preciso, conclusione ferma. Il partecipante usa i termini che ha visto nel KG."
            : "KG style: structured cause-effect answer, precise technical vocabulary, firm conclusion. The participant echoes terms seen in the KG output."
          : definition.tool === "LLM"
            ? locale === "it"
              ? "Stile LLM: tono conversazionale, il partecipante parafrasa quello che il chatbot ha detto, a volte in modo acritico. Può includere frasi come 'il chatbot mi ha detto che...' o 'secondo l'AI potrebbe essere...'."
              : "LLM style: conversational tone, participant paraphrases what the chatbot said, sometimes uncritically. May include phrases like 'the chatbot told me...' or 'according to the AI it might be...'."
            : locale === "it"
              ? "Stile DOC: taglio procedurale, riferimenti a pagine o sezioni del manuale, frasi come 'ho trovato nella documentazione che...' o 'la guida dice di verificare...'. Spesso incompleto."
              : "DOC style: procedural tone, references to manual pages or sections, phrases like 'I found in the documentation that...' or 'the guide says to check...'. Often incomplete.",
      scenario: {
        difficulty: scenario.difficulty,
        subsystem: resolveText(scenario.subsystem, locale),
        machine_state: resolveText(scenario.machine_state, locale),
        process_parameters: resolveText(scenario.process_parameters, locale),
        observable_symptoms: resolveTextList(scenario.observable_symptoms, locale),
        error_code: scenario.error_code,
        error_message: resolveText(scenario.error_message, locale),
      },
    };
  });

  // Personality interpretation block for the model
  const verbosity = guidance.answer_verbosity_percent ?? 50;
  const decisiveness = guidance.decisiveness_percent ?? 50;
  const trustPercent = guidance.tool_trust_percent ?? 50;

  const personalityInterpretation =
    locale === "it"
      ? [
          `answer_verbosity_percent=${verbosity}: ${verbosity < 30 ? "risposte molto brevi, 1-2 frasi, quasi telegrafiche" : verbosity < 60 ? "risposte di lunghezza media, 2-4 frasi" : "risposte lunghe e dettagliate, 5+ frasi, ridondanti"}`,
          `decisiveness_percent=${decisiveness}: ${decisiveness < 30 ? "conclusioni molto incerte, usa 'forse', 'potrebbe', 'non so se'; non arriva mai a una diagnosi definitiva" : decisiveness < 60 ? "conclusioni moderatamente incerte, ipotesi con qualche riserva" : "conclusioni decise e dirette, usa 'il problema è...', 'bisogna sostituire...', senza esitazioni"}`,
          `tool_trust_percent=${trustPercent}: ${trustPercent < 30 ? "alta diffidenza verso gli strumenti, aggiunge sempre disclaimer e dubbi sulle risposte ricevute" : trustPercent < 60 ? "fiducia moderata, accetta le risposte ma con qualche riserva" : "alta fiducia, si affida allo strumento senza mettere in discussione l'output"}`,
          guidance.study_profile_hint ? `study_profile_hint='${guidance.study_profile_hint}': usa lessico e ragionamento coerenti con questo profilo. Un ingegnere meccanico usa termini tecnici precisi (tolleranze, attriti, termini di macchina); un profilo più gestionale è più vago sui dettagli tecnici.` : "",
          guidance.notes ? `notes='${guidance.notes}': rispetta questi vincoli aggiuntivi nel caratterizzare il partecipante.` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `answer_verbosity_percent=${verbosity}: ${verbosity < 30 ? "very short answers, 1-2 sentences, almost telegraphic" : verbosity < 60 ? "medium-length answers, 2-4 sentences" : "long, detailed answers, 5+ sentences, with redundant steps"}`,
          `decisiveness_percent=${decisiveness}: ${decisiveness < 30 ? "very uncertain conclusions, uses 'maybe', 'could be', 'I'm not sure'; never reaches a definitive diagnosis" : decisiveness < 60 ? "moderately uncertain conclusions, hypotheses with some reservations" : "firm, direct conclusions, uses 'the problem is...', 'you need to replace...', no hedging"}`,
          `tool_trust_percent=${trustPercent}: ${trustPercent < 30 ? "high distrust toward tools, always adds disclaimers and doubts about received answers" : trustPercent < 60 ? "moderate trust, accepts answers but with some reservations" : "high trust, relies on the tool without questioning its output"}`,
          guidance.study_profile_hint ? `study_profile_hint='${guidance.study_profile_hint}': use vocabulary and reasoning consistent with this profile. A mechanical engineer uses precise technical terms (tolerances, friction, machine-specific vocabulary); a more managerial profile is vaguer on technical details.` : "",
          guidance.notes ? `notes='${guidance.notes}': respect these additional constraints when characterizing the participant.` : "",
        ]
          .filter(Boolean)
          .join("\n");

  const guidanceSummary =
    locale === "it"
      ? {
          participant_name: guidance.participant_name || "(libero — scegli un nome italiano o internazionale plausibile)",
          age: guidance.age ?? "(libero — intero plausibile 18-99)",
          gender: guidance.gender || "(libero — male oppure female)",
          study_profile_hint:
            guidance.study_profile_hint ||
            "(libero — scegli un solo campo, es. Magistrale in Ingegneria Meccanica, Dottorando in Ingegneria Industriale, Tecnico di laboratorio)",
          exp_3d_printing: guidance.exp_3d_printing || "(libero — prevalentemente 'none' o 'basic')",
          conf_troubleshooting: guidance.conf_troubleshooting ?? "(libero — intero 1-7)",
          fam_manufacturing: guidance.fam_manufacturing ?? "(libero — intero 1-7)",
          preferred_tool: guidance.preferred_tool || "(libero)",
          least_preferred_tool: guidance.least_preferred_tool || "(libero)",
          personality_interpretation: personalityInterpretation,
        }
      : {
          participant_name: guidance.participant_name || "(free — choose a plausible Italian or international name)",
          age: guidance.age ?? "(free — plausible integer 18-99)",
          gender: guidance.gender || "(free — male or female)",
          study_profile_hint:
            guidance.study_profile_hint ||
            "(free — single field, e.g. MSc Mechanical Engineering, PhD candidate in Industrial Engineering, Lab technician)",
          exp_3d_printing: guidance.exp_3d_printing || "(free — mostly 'none' or 'basic')",
          conf_troubleshooting: guidance.conf_troubleshooting ?? "(free — integer 1-7)",
          fam_manufacturing: guidance.fam_manufacturing ?? "(free — integer 1-7)",
          preferred_tool: guidance.preferred_tool || "(free)",
          least_preferred_tool: guidance.least_preferred_tool || "(free)",
          personality_interpretation: personalityInterpretation,
        };

  const rankingConstraintLines =
    locale === "it"
      ? [
          guidance.preferred_tool
            ? `Vincolo duro ranking: \`post_session.rank_1\` deve essere esattamente "${guidance.preferred_tool}".`
            : "Nessun vincolo duro su `post_session.rank_1`.",
          guidance.least_preferred_tool
            ? `Vincolo duro ranking: \`post_session.rank_3\` deve essere esattamente "${guidance.least_preferred_tool}".`
            : "Nessun vincolo duro su `post_session.rank_3`.",
          guidance.preferred_tool || guidance.least_preferred_tool
            ? `Se rispetti i vincoli, l'ordine finale ammesso è: ${constrainedRanking.join(" > ")}.`
            : "Scegli il ranking finale in base all'esperienza concreta nei tre task.",
          "La motivazione del ranking deve richiamare cosa è successo in ciascun task, non preferenze astratte sui tool.",
        ]
      : [
          guidance.preferred_tool
            ? `Hard ranking constraint: \`post_session.rank_1\` must be exactly "${guidance.preferred_tool}".`
            : "No hard constraint on `post_session.rank_1`.",
          guidance.least_preferred_tool
            ? `Hard ranking constraint: \`post_session.rank_3\` must be exactly "${guidance.least_preferred_tool}".`
            : "No hard constraint on `post_session.rank_3`.",
          guidance.preferred_tool || guidance.least_preferred_tool
            ? `If you respect the constraints, the only allowed final order is: ${constrainedRanking.join(" > ")}.`
            : "Choose the final ranking based on the lived experience across the three tasks.",
          "The ranking justification must refer to what happened in each task, not generic abstract tool preferences.",
        ];

  const instructions =
    locale === "it"
      ? [
          "Genera un partecipante sintetico completo in italiano.",
          "Il campo `demographics.first_name` deve contenere nome e cognome completi. Se lo sperimentatore fornisce solo un nome, inventa tu un cognome plausibile. Se non fornisce nulla, inventa nome e cognome plausibili (italiani o internazionali).",
          "Se un campo guida è valorizzato, trattalo come vincolo esplicito; se è vuoto, scegli un valore plausibile coerente con il profilo.",
          "Usa `demographics.age` come intero plausibile tra 18 e 99.",
          "Usa `demographics.gender` solo con uno di questi valori: male, female.",
          "Usa `demographics.study_profile` come unico campo per titolo/profilo di studio o lavoro. Non duplicare questa informazione in più campi.",
          "Mantieni `exp_3d_printing` in uno di questi valori: none, basic, intermediate, advanced.",
          "Usa interi 1-7 per `confidence_score`, `trust_t1`, `trust_t2`, `trust_t3`, `conf_troubleshooting`, `fam_manufacturing`. NON generare tutti valori uguali o uniformemente medi.",
          "Usa `time_spent_seconds` tra 30 e 300. Se `timed_out` è true, imposta `time_spent_seconds` a 300 e tronca il testo di diagnosis_text a metà frase.",
          "I tre task devono avere `task_order` 1, 2 e 3 nell'ordine esatto fornito.",
          "Ogni task deve avere testi diversi e scenario-specifici. Non riusare frasi o strutture identiche tra task diversi.",
          "In ogni task il testo deve citare almeno un indizio concreto dello scenario (sintomo, codice errore, parametro di processo).",
          "Rifletti sempre lo strumento assegnato nel tono e nel contenuto delle risposte secondo gli hint forniti per ciascun task.",
          "Evita testo generico da LLM: ogni risposta deve sembrare prodotta da una persona specifica con quel background, quel livello di decisione e quel grado di fiducia nello strumento.",
          "Fai emergere differenze nette tra i tre task: uno può essere più deciso, uno più confuso, uno più procedurale, coerentemente con tool, difficoltà e persona.",
          "Introduci 1-2 errori di battitura naturali per task (non in ogni parola).",
          "Il ranking finale deve essere coerente con l'esperienza vissuta nei tre task. `rank_justification` deve citare dettagli specifici di quella esperienza.",
          "Se è presente un preferred_tool o least_preferred_tool, il ranking finale DEVE rispettarlo senza eccezioni.",
          "Compila sempre tutti i campi. `rank_justification` e `open_comment` non possono essere vuoti.",
        ].join("\n")
      : [
          "Generate a complete synthetic participant in English.",
          "The `demographics.first_name` field must contain a full first-and-last name. If the experimenter provides only one name, invent a plausible surname. If nothing is provided, invent both a plausible first and last name (Italian or international).",
          "If a guidance field is populated, treat it as an explicit constraint; if blank, choose a plausible value consistent with the profile.",
          "Use `demographics.age` as a plausible integer between 18 and 99.",
          "Use `demographics.gender` with one of these values only: male, female.",
          "Use `demographics.study_profile` as the single field for title/study/work profile. Do not duplicate this information across multiple fields.",
          "Keep `exp_3d_printing` within: none, basic, intermediate, advanced.",
          "Use 1-7 integers for `confidence_score`, `trust_t1`, `trust_t2`, `trust_t3`, `conf_troubleshooting`, `fam_manufacturing`. Do NOT make all values equal or uniformly mid-range.",
          "Use `time_spent_seconds` between 30 and 300. If `timed_out` is true, set `time_spent_seconds` to 300 and truncate diagnosis_text mid-sentence.",
          "The three task items must have `task_order` 1, 2, and 3 in the exact order provided.",
          "Each task must use different, scenario-specific wording. Do not reuse identical phrases or structures across tasks.",
          "In each task the text must reference at least one concrete scenario clue (symptom, error code, process parameter).",
          "Always reflect the assigned tool in the tone and content of the responses according to the per-task hints provided.",
          "Avoid generic LLM filler: each answer must feel written by a specific person with that background, decisiveness level, and trust profile.",
          "Make the three task responses meaningfully different from one another: one can be firmer, one more confused, one more procedural, as long as that matches tool, difficulty, and persona.",
          "Introduce 1-2 natural typos per task response (occasional, not in every word).",
          "The final ranking must be consistent with the participant's lived experience across the three tasks. `rank_justification` must cite specific details of that experience.",
          "If a preferred_tool or least_preferred_tool is provided, the final ranking MUST satisfy it with no exceptions.",
          "Always fill every field. `rank_justification` and `open_comment` must not be empty.",
        ].join("\n");

  const responseShape = {
    demographics: {
      first_name: "string",
      age: "integer 18-99",
      gender: "male|female",
      study_profile: "string",
      exp_3d_printing: "none|basic|intermediate|advanced",
      conf_troubleshooting: "integer 1-7",
      fam_manufacturing: "integer 1-7",
    },
    tasks: [
      {
        task_order: 1,
        diagnosis_text: "string",
        corrective_action_text: "string",
        confidence_score: "integer 1-7",
        trust_t1: "integer 1-7",
        trust_t2: "integer 1-7",
        trust_t3: "integer 1-7",
        time_spent_seconds: "integer 30-300",
        timed_out: "boolean",
      },
    ],
    post_session: {
      rank_1: "KG|LLM|DOC",
      rank_2: "KG|LLM|DOC",
      rank_3: "KG|LLM|DOC",
      rank_justification: "string",
      open_comment: "string",
    },
  };

  return [
    instructions,
    "",
    locale === "it" ? `GRUPPO ASSEGNATO: ${groupId}` : `ASSIGNED GROUP: ${groupId}`,
    locale === "it" ? "GUIDA DELLO SPERIMENTATORE E INTERPRETAZIONE PERSONALITÀ:" : "EXPERIMENTER GUIDANCE AND PERSONALITY INTERPRETATION:",
    JSON.stringify(guidanceSummary, null, 2),
    "",
    locale === "it" ? "VINCOLI DI RANKING:" : "RANKING CONSTRAINTS:",
    rankingConstraintLines.join("\n"),
    "",
    locale === "it" ? "PIANO TASK DA RISPETTARE:" : "TASK PLAN TO FOLLOW:",
    JSON.stringify(taskPlan, null, 2),
    "",
    locale === "it" ? "FORMATO JSON ATTESO:" : "EXPECTED JSON SHAPE:",
    JSON.stringify(responseShape, null, 2),
  ].join("\n");
}

async function callOpenAIJson(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const rawContent = data.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("OpenAI response did not include message content.");
  }

  return JSON.parse(rawContent) as unknown;
}

function normalizeGeneratedSession(
  generated: GeneratedSyntheticSession,
  locale: Locale,
  groupId: string,
  preferredTool?: ToolCode | null,
  leastPreferredTool?: ToolCode | null,
) {
  const expectedOrders = [1, 2, 3];
  const sortedTasks = [...generated.tasks].sort((a, b) => a.task_order - b.task_order);
  const normalizedName = ensureFullName(generated.demographics.first_name, locale);

  sortedTasks.forEach((task, index) => {
    if (task.task_order !== expectedOrders[index]) {
      throw new Error("Generated tasks returned an invalid task order.");
    }
  });

  const config = getStudyConfig();
  const allTools = Object.keys(config.tools) as ToolCode[];
  const normalizedRanking = buildConstrainedRanking(
    [generated.post_session.rank_1, generated.post_session.rank_2, generated.post_session.rank_3],
    allTools,
    preferredTool,
    leastPreferredTool,
  );

  [1, 2, 3].forEach((taskOrder) => {
    const definition = getTaskDefinition(groupId, taskOrder);
    if (!definition) {
      throw new Error(`Missing task definition for ${groupId} task ${taskOrder}.`);
    }

    const task = sortedTasks[taskOrder - 1];
    task.time_spent_seconds = task.timed_out ? 300 : Math.min(Math.max(task.time_spent_seconds, 30), 300);
  });

  assertDistinctTaskResponses(sortedTasks);

  if (new Set(allTools).size !== 3) {
    throw new Error("Unexpected tool configuration.");
  }

  return {
    ...generated,
    demographics: {
      ...generated.demographics,
      first_name: normalizedName,
    },
    tasks: sortedTasks,
    post_session: {
      ...generated.post_session,
      rank_1: normalizedRanking[0],
      rank_2: normalizedRanking[1],
      rank_3: normalizedRanking[2],
    },
  };
}

export async function generateSyntheticParticipant(
  locale: Locale,
  groupId: string,
  guidance: SyntheticParticipantGuidance,
) {
  const systemPrompt = getSystemPrompt(locale);
  const basePrompt = buildUserPrompt(locale, groupId, guidance);
  const corrections: string[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const correctionBlock =
      corrections.length > 0
        ? `\n\n${locale === "it" ? "CORREZIONI OBBLIGATORIE:" : "MANDATORY CORRECTIONS:"}\n- ${corrections.join("\n- ")}`
        : "";
    const attemptPrompt = `${basePrompt}${correctionBlock}`;

    try {
      const parsed = await callOpenAIJson(systemPrompt, attemptPrompt);
      const generated = generatedSyntheticSessionSchema.parse(parsed);

      return normalizeGeneratedSession(
        generated,
        locale,
        groupId,
        guidance.preferred_tool ?? null,
        guidance.least_preferred_tool ?? null,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown generation error.");
      corrections.push(
        locale === "it"
          ? `Rigenera rispettando questo vincolo: ${lastError.message}`
          : `Regenerate while respecting this constraint: ${lastError.message}`,
      );
    }
  }

  throw lastError ?? new Error("Unable to generate a valid synthetic participant.");
}

export function getSyntheticModelName() {
  return MODEL;
}
