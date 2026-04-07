import { NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";

import { exportColumns, getAdminResultRows, normaliseExportValue } from "@/lib/export";

export async function GET() {
  const rows = await getAdminResultRows();

  const csv = stringify(
    rows.map((row) =>
      Object.fromEntries(exportColumns.map((column) => [column, normaliseExportValue(row[column])])),
    ),
    {
      header: true,
      columns: [...exportColumns],
      quoted: true,
    },
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="study-export.csv"',
    },
  });
}
