import { useState } from "react";
import {
  blockLabel,
  type Block,
  type Filters,
  type analytics,
} from "@kk/shared";
import { ArrowDown, ArrowUp } from "lucide-react";
type Data = ReturnType<typeof analytics>;
type SortKey = "name" | "student_id" | "block" | "entryDays" | "entries";
export default function RecordedEntryTable({
  data,
  blocks,
  filters,
  onDetails,
}: {
  data: Data;
  blocks: Block[];
  filters: Filters;
  onDetails: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("entryDays"),
    [ascending, setAscending] = useState(false),
    [page, setPage] = useState(0);
  const value = (row: Data["residentActivity"][number], key: SortKey) =>
    key === "name" || key === "student_id"
      ? row.student[key]
      : key === "block"
        ? blockLabel(blocks, row.student.block_id)
        : row[key];
  const rows = [...data.residentActivity].sort((a, b) => {
    const av = value(a, sort),
      bv = value(b, sort);
    const comparison =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return (
      comparison * (ascending ? 1 : -1) ||
      a.student.student_id.localeCompare(b.student.student_id)
    );
  });
  function changeSort(key: SortKey) {
    setAscending(
      key === sort ? !ascending : key !== "entryDays" && key !== "entries",
    );
    setSort(key);
    setPage(0);
  }
  const headings: { key: SortKey; title: string }[] = [
    { key: "name", title: "Student" },
    { key: "student_id", title: "Student ID" },
    { key: "block", title: "Assigned block" },
    { key: "entryDays", title: "Recorded entry days" },
    { key: "entries", title: "Successful entries" },
  ];
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Recorded entry activity by resident</h2>
          <p>
            {filters.from} — {filters.to} · inclusive dates · MYT (UTC+8)
          </p>
        </div>
      </div>
      <div className="notice" style={{ margin: "0 24px 20px" }}>
        These are distinct days with successful entry scans, not actual days
        stayed or nights stayed. Multiple entries on one day count as one
        recorded entry day. Do not use this ordering to determine residential
        eligibility.
      </div>
      <div className="inline-stats">
        <div>
          <span>Average recorded entry days per resident</span>
          <strong>{data.averageEntryDays.toFixed(1)} days</strong>
        </div>
        <div>
          <span>Residents included</span>
          <strong>{rows.length}, including zero-entry residents</strong>
        </div>
      </div>
      <p className="fine" style={{ padding: "0 24px 16px" }}>
        Average = sum of residents’ recorded entry days ÷ active residents
        currently assigned to selected blocks. Only successful entries at the
        selected blocks during the selected dates count. Historical permissions
        may differ from current assignments. Click a column heading to sort.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headings.map((h) => (
                <th
                  key={h.key}
                  aria-sort={
                    sort === h.key
                      ? ascending
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="text-button"
                    onClick={() => changeSort(h.key)}
                  >
                    {h.title}
                    {sort === h.key ? (
                      ascending ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 15, page * 15 + 15).map((row) => (
              <tr key={row.student.id}>
                <td>{row.student.name}</td>
                <td>{row.student.student_id}</td>
                <td>{blockLabel(blocks, row.student.block_id)}</td>
                <td>
                  <strong>{row.entryDays}</strong>
                </td>
                <td>{row.entries}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onDetails(row.student.id)}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty-state">
          No active residents match the selected college and block.
        </p>
      )}
      <div className="table-pagination">
        <span>
          {rows.length ? page * 15 + 1 : 0}–
          {Math.min(page * 15 + 15, rows.length)} of {rows.length} residents
        </span>
        <div>
          <button
            className="button small"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous residents
          </button>
          <button
            className="button small"
            disabled={(page + 1) * 15 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next residents
          </button>
        </div>
      </div>
    </section>
  );
}
