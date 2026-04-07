import { AdminResultsTable } from "@/components/AdminResultsTable";
import { getAdminResultRows } from "@/lib/export";
import { getCopy } from "@/lib/i18n";
import { getLocaleFromCookie } from "@/lib/session";

export default async function AdminResultsPage() {
  const locale = getLocaleFromCookie();
  const t = getCopy(locale);
  const rows = await getAdminResultRows();

  return (
    <main className="space-y-6">
      <AdminResultsTable
        rows={rows}
        labels={{
          title: t.adminResults.title,
          intro: t.adminResults.intro,
          downloadCsv: t.adminResults.downloadCsv,
          noResults: t.adminResults.noResults,
          overviewSessions: t.adminResults.overviewSessions,
          overviewRows: t.adminResults.overviewRows,
          overviewCompleted: t.adminResults.overviewCompleted,
          edit: t.adminResults.edit,
          save: t.adminResults.save,
          cancel: t.adminResults.cancel,
          delete: t.adminResults.delete,
          deleteConfirm: t.adminResults.deleteConfirm,
          saveError: t.adminResults.saveError,
          deleteError: t.adminResults.deleteError,
          sessionSection: t.adminResults.sessionSection,
          taskSection: t.adminResults.taskSection,
          postSection: t.adminResults.postSection,
          participantId: t.admin.participantId,
          group: t.admin.group,
          date: t.adminResults.date,
          firstName: t.demographics.firstName,
          age: t.demographics.age,
          gender: t.demographics.gender,
          studyProfile: t.demographics.studyProfile,
          experience: t.demographics.experience,
          troubleshooting: t.demographics.confidence,
          manufacturing: t.demographics.manufacturing,
          taskOrder: t.adminResults.taskOrder,
          scenario: t.task.scenario,
          tool: t.adminResults.tool,
          startTime: t.adminResults.startTime,
          endTime: t.adminResults.endTime,
          timeSpent: t.adminResults.timeSpent,
          timedOut: t.adminResults.timedOut,
          diagnosis: t.task.diagnosis,
          correctiveAction: t.task.action,
          confidence: t.task.confidence,
          trust1: t.adminResults.trust1,
          trust2: t.adminResults.trust2,
          trust3: t.adminResults.trust3,
          rank1: t.postSession.rank1,
          rank2: t.postSession.rank2,
          rank3: t.postSession.rank3,
          rankJustification: t.postSession.justification,
          openComment: t.postSession.comment,
          noTask: t.adminResults.noTask,
          booleanTrue: t.adminResults.booleanTrue,
          booleanFalse: t.adminResults.booleanFalse,
        }}
      />
    </main>
  );
}
