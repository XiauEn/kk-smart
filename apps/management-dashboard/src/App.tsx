import StudentDetail from "./StudentDetail";
import RecordedEntryTable from "./RecordedEntryTable";
import HolidayPlanning from "./HolidayPlanning";
import {
  Badge,
  Brand,
  ErrorNotice,
  Metric,
  ModeBanner,
  SessionButton,
  analytics,
  blockLabel,
  dayKey,
  dayOffset,
  timeLabel,
  useKK,
  type Filters,
  type Student,
} from "@kk/shared";
import "@kk/shared/styles.css";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Clock3,
  DoorOpen,
  Download,
  Info,
  LayoutDashboard,
  ListOrdered,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const navigation = [
  { id: "overview", title: "Overview", icon: LayoutDashboard },
  { id: "activity", title: "Residential activity", icon: ChartNoAxesCombined },
  { id: "entry-days", title: "Recorded entry days", icon: ListOrdered },
  { id: "holiday", title: "Holiday planning", icon: CalendarDays },
  { id: "security", title: "Security monitoring", icon: ShieldAlert },
  { id: "records", title: "Residential records", icon: Users },
];
const titles: Record<string, [string, string]> = {
  overview: [
    "A safer campus starts here.",
    "Your residential community, at a glance.",
  ],
  activity: [
    "Residential activity",
    "Understand patterns. Plan with perspective.",
  ],
  "entry-days": [
    "Recorded entry days",
    "Review recorded entry activity by resident. These figures do not measure days stayed.",
  ],
  holiday: [
    "Holiday safety planning",
    "Support the students who call campus home.",
  ],
  security: [
    "Security monitoring",
    "Review access events and respond with context.",
  ],
  records: ["Residential records", "Manage verified residential permissions."],
};
function ChartPanel({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`panel chart-panel ${wide ? "wide" : ""}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="chart-menu">•••</span>
      </div>
      <div className="chart-wrap">{children}</div>
    </section>
  );
}
function Management() {
  const s = useKK();
  const [page, setPage] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [filters, setFilters] = useState<Filters>({
      kk: "",
      block: "",
      from: dayOffset(-29),
      to: dayOffset(0),
    }),
    [query, setQuery] = useState(""),
    [recordPage, setRecordPage] = useState(0),
    [edit, setEdit] = useState<Student | null>(null),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const [detailId, setDetailId] = useState("");
  const [trend, setTrend] = useState<"day" | "week" | "month">("day");
  useEffect(() => {
    const read = () => {
      const m = location.hash.match(/^#student\/([0-9a-f-]+)$/i);
      setDetailId(m?.[1] ?? "");
      if (m) setPage("records");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const detail = s.data.students.find((st) => st.id === detailId);
  function openDetail(id: string) {
    window.scrollTo({ top: 0 });
    setDetailId(id);
    location.hash = "student/" + id;
  }
  const a = useMemo(() => analytics(s.data, filters), [s.data, filters]);
  const activeAlerts = s.data.alerts.filter(
    (x) => x.status !== "resolved",
  ).length;
  const records = s.data.students.filter(
    (st) =>
      (!filters.kk ||
        s.data.blocks.some(
          (b) => b.id === st.block_id && b.kk_name === filters.kk,
        )) &&
      (!filters.block || st.block_id === filters.block) &&
      `${st.name} ${st.student_id}`.toLowerCase().includes(query.toLowerCase()),
  );
  function download() {
    const rows = [
      "date,successful_entries,denied_attempts,unique_entrants",
      ...a.days.map((d) => `${d.date},${d.granted},${d.denied},${d.unique}`),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "kk-smart-aggregate-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  function navigate(id: string) {
    window.scrollTo({ top: 0 });
    setPage(id);
    setDetailId("");
    history.replaceState(null, "", location.pathname + location.search);
    setMobile(false);
    setMessage("");
  }
  const statusTone = (status: string) =>
    status === "active" || status === "resolved"
      ? "success"
      : status === "expired" || status === "new"
        ? "danger"
        : "warning";
  const activityChart = (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={a.days}
        margin={{ left: -22, right: 10, top: 12, bottom: 0 }}
      >
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c8e7b" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#0c8e7b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 5"
          vertical={false}
          stroke="#e9eeed"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          minTickGap={35}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #e5eae9" }}
        />
        <Area
          type="monotone"
          dataKey="granted"
          name="Successful entries"
          stroke="#0b8c79"
          fill="url(#activityFill)"
          strokeWidth={2.5}
        />
        <Area
          type="monotone"
          dataKey="denied"
          name="Denied attempts"
          stroke="#e1796d"
          fill="transparent"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
  return (
    <>
      <div className="dashboard-shell">
        <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
          <Brand />
          <button
            className="mobile-close icon-button"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          <div className="workspace-select">
            <span className="workspace-avatar">UM</span>
            <div>
              <strong>Residential management</strong>
              <small>University of Malaya</small>
            </div>
            <ChevronRight size={14} />
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {navigation.map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                {n.title}
                {n.id === "security" && activeAlerts > 0 && (
                  <span className="nav-count">{activeAlerts}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={23} />
            <h3>Safety without surveillance.</h3>
            <p>
              Activity supports planning. It never determines a student's right
              to a home.
            </p>
            <span>
              OUR COMMITMENT <ArrowUpRight size={12} />
            </span>
          </div>
          <div className="sidebar-bottom">
            <div className="admin-avatar">RM</div>
            <div>
              <strong>
                {s.connected ? "Authorised management" : "Demo administrator"}
              </strong>
              <small>Residential office</small>
            </div>
            <SessionButton />
          </div>
        </aside>
        <div className="dashboard-body">
          <header className="dashboard-header">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              Workspace
              <ChevronRight size={13} />
              <strong>{navigation.find((n) => n.id === page)?.title}</strong>
            </div>
            <div className="header-actions">
              <Badge
                tone={
                  s.connected ? (s.stale ? "warning" : "success") : "neutral"
                }
              >
                {s.connected
                  ? s.stale
                    ? "Data may be stale"
                    : "Live connection"
                  : "Demo workspace"}
              </Badge>
              <button
                className="notification-button"
                aria-label={`${activeAlerts} active security alerts`}
                onClick={() => navigate("security")}
              >
                <Bell size={19} />
                {activeAlerts > 0 && <i />}
              </button>
              <div className="admin-avatar small-avatar">RM</div>
            </div>
          </header>
          <ModeBanner />
          <main className="dashboard-main">
            <div className="dashboard-title">
              <div>
                <div className="eyebrow">
                  KK SMART /{" "}
                  {page === "overview"
                    ? "MANAGEMENT OVERVIEW"
                    : navigation
                        .find((n) => n.id === page)
                        ?.title.toUpperCase()}
                </div>
                <h1>{titles[page][0]}</h1>
                <p>{titles[page][1]}</p>
              </div>
              <button className="button" onClick={download}>
                <Download size={15} />
                Export aggregate data
              </button>
            </div>
            {!detail && (
              <div className="filter-bar panel">
                <div className="filter-title">
                  <SlidersHorizontal size={16} />
                  Filters
                </div>
                <select
                  aria-label="Filter college"
                  value={filters.kk}
                  onChange={(e) => {
                    setFilters({ ...filters, kk: e.target.value, block: "" });
                    setRecordPage(0);
                  }}
                >
                  <option value="">All residential colleges</option>
                  {[...new Set(s.data.blocks.map((b) => b.kk_name))].map(
                    (k) => (
                      <option key={k}>{k}</option>
                    ),
                  )}
                </select>
                <select
                  aria-label="Filter block"
                  value={filters.block}
                  onChange={(e) => {
                    setFilters({ ...filters, block: e.target.value });
                    setRecordPage(0);
                  }}
                >
                  <option value="">All blocks</option>
                  {s.data.blocks
                    .filter((b) => !filters.kk || b.kk_name === filters.kk)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {blockLabel(s.data.blocks, b.id)}
                      </option>
                    ))}
                </select>
                {page !== "holiday" && page !== "records" && (
                  <>
                    <label className="date-filter">
                      <CalendarDays size={14} />
                      <input
                        aria-label="Start date"
                        type="date"
                        value={filters.from}
                        max={filters.to}
                        min={dayOffset(-59)}
                        onChange={(e) =>
                          e.target.value &&
                          setFilters({ ...filters, from: e.target.value })
                        }
                      />
                      <span>—</span>
                      <input
                        aria-label="End date"
                        type="date"
                        value={filters.to}
                        min={filters.from}
                        max={dayOffset(0)}
                        onChange={(e) =>
                          e.target.value &&
                          setFilters({ ...filters, to: e.target.value })
                        }
                      />
                    </label>
                    <select
                      aria-label="Date range preset"
                      value={
                        Math.round(
                          (Date.parse(filters.to) - Date.parse(filters.from)) /
                            86400000,
                        ) + 1
                      }
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          from: dayOffset(1 - Number(e.target.value)),
                          to: dayOffset(0),
                        })
                      }
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                      {![7, 30, 60].includes(
                        Math.round(
                          (Date.parse(filters.to) - Date.parse(filters.from)) /
                            86400000,
                        ) + 1,
                      ) && (
                        <option
                          value={
                            Math.round(
                              (Date.parse(filters.to) -
                                Date.parse(filters.from)) /
                                86400000,
                            ) + 1
                          }
                        >
                          Custom range
                        </option>
                      )}
                    </select>
                  </>
                )}
              </div>
            )}
            <ErrorNotice />
            {message && (
              <div className="notice" role="status">
                {message}
              </div>
            )}
            {s.stale && s.connected && (
              <div className="notice warning">
                <Clock3 size={16} />
                Data may be stale. Last available in-memory snapshot; reconnect
                to refresh.
                <button
                  className="text-button"
                  onClick={() => void s.refresh()}
                >
                  Refresh
                </button>
              </div>
            )}
            {page === "overview" && (
              <>
                <p className="section-explainer">
                  What needs attention? {a.blocks.length} blocks · {a.unique}{" "}
                  different entrants · {a.events.length.toLocaleString()} total
                  attempts in the selected period.
                </p>
                <div className="metric-grid">
                  <Metric
                    label="Registered residents"
                    value={a.residents.length}
                    icon={<Users size={18} />}
                    detail="Active permissions in selected blocks"
                  />

                  <Metric
                    label="Successful entries"
                    detail="Granted entry events, including repeat entries"
                    value={a.granted.length.toLocaleString()}
                    icon={<Check size={18} />}
                  />
                  <Metric
                    label="Denied attempts"
                    detail="Rejected scans; not necessarily intruders"
                    value={(
                      a.events.length - a.granted.length
                    ).toLocaleString()}
                    icon={<ShieldAlert size={18} />}
                  />
                  <Metric
                    label="Alerts requiring review"
                    detail="New or under-review alerts in selected dates"
                    value={
                      a.alerts.filter((x) => x.status !== "resolved").length
                    }
                    icon={<Bell size={18} />}
                  />
                </div>
                <div className="charts-grid">
                  <ChartPanel
                    title="Residential access activity"
                    subtitle="Daily successful entries and denied attempts"
                    wide
                  >
                    {activityChart}
                  </ChartPanel>
                  <ChartPanel
                    title="Access outcomes"
                    subtitle="All attempts in your selected period"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Successful", value: a.granted.length },
                            {
                              name: "Denied",
                              value: a.events.length - a.granted.length,
                            },
                          ]}
                          dataKey="value"
                          innerRadius={66}
                          outerRadius={91}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          <Cell fill="#0c8876" />
                          <Cell fill="#eea293" />
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <strong>
                        {a.events.length
                          ? Math.round(
                              (a.granted.length / a.events.length) * 100,
                            )
                          : 0}
                        %
                      </strong>
                      <small>successful</small>
                    </div>
                  </ChartPanel>
                </div>
                <div className="charts-grid equal">
                  <ChartPanel
                    title="Activity across blocks"
                    subtitle="Recorded attempts, grouped by residential block"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={a.comparison}
                        margin={{ left: -25, right: 5 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 5" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip />
                        <Legend iconSize={8} />
                        <Bar
                          dataKey="granted"
                          name="Successful"
                          fill="#158d7d"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="denied"
                          name="Denied"
                          fill="#edb3a7"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                  <section className="panel security-summary">
                    <div className="panel-heading">
                      <div>
                        <h2>Security needs a human perspective.</h2>
                        <p>Recent alerts within selected filters</p>
                      </div>
                      <ShieldCheck size={23} />
                    </div>
                    {a.alerts.slice(0, 3).map((al) => (
                      <div className="summary-alert" key={al.id}>
                        <span
                          className={`event-icon ${al.status === "resolved" ? "success" : "danger"}`}
                        >
                          <ShieldAlert size={17} />
                        </span>
                        <div>
                          <strong>
                            {blockLabel(s.data.blocks, al.block_id)}
                          </strong>
                          <small>
                            Five denied attempts · {dayKey(al.timestamp)}
                          </small>
                        </div>
                        <Badge tone={statusTone(al.status)}>
                          {al.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                    {!a.alerts.length && (
                      <p className="empty-state">No alerts in this period.</p>
                    )}
                    <button
                      className="text-button"
                      onClick={() => navigate("security")}
                    >
                      View security monitoring
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
                <div className="principle-strip">
                  <div className="principle-icon">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <strong>Better insight. Responsible decisions.</strong>
                    <p>
                      Entry frequency is not nights stayed. This platform does
                      not rank students or determine residential eligibility.
                    </p>
                  </div>
                  <Badge>Privacy by design</Badge>
                </div>
              </>
            )}
            {page === "entry-days" && (
              <RecordedEntryTable
                key={`${filters.kk}-${filters.block}-${filters.from}-${filters.to}`}
                data={a}
                blocks={s.data.blocks}
                filters={filters}
                onDetails={(id) => {
                  setPage("records");
                  openDetail(id);
                }}
              />
            )}
            {page === "activity" && (
              <>
                <label className="trend-control">
                  Entry trend grouping
                  <select
                    aria-label="Entry trend grouping"
                    value={trend}
                    onChange={(e) => setTrend(e.target.value as typeof trend)}
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </label>
                <div className="notice">
                  <Info size={18} />
                  Recorded entry events describe activity, not occupancy, nights
                  stayed, or accommodation eligibility.
                </div>

                <div className="metric-grid three">
                  <Metric
                    label="Successful entry events"
                    value={a.granted.length.toLocaleString()}
                    icon={<DoorOpen size={18} />}
                  />
                  <Metric
                    label="Distinct days with entries"
                    value={a.distinctDays}
                    icon={<CalendarDays size={18} />}
                  />
                  <Metric
                    label="Unique students entering"
                    value={a.unique}
                    icon={<Users size={18} />}
                  />
                </div>
                <div className="charts-grid equal">
                  <ChartPanel
                    title="Entry activity trend"
                    subtitle="Selected date range"
                  >
                    {trend === "day" ? (
                      activityChart
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={trend === "week" ? a.weekly : a.monthly}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 5"
                          />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar
                            dataKey="value"
                            name="Successful entries"
                            fill="#158d7d"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartPanel>
                  <ChartPanel
                    title="Daily unique entrants"
                    subtitle="Distinct identities with successful entry"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={a.days} margin={{ left: -25 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 5" />
                        <XAxis
                          dataKey="label"
                          minTickGap={35}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="unique"
                          name="Unique entrants"
                          fill="#4288ac"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                  <ChartPanel
                    title="Recorded entry days · frequency"
                    subtitle="Active residents, including those with no recorded entry days"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={a.frequency} margin={{ left: -25 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 5" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          name="Residents"
                          fill="#158d7d"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </div>
                <div className="panel table-panel">
                  <div className="panel-heading">
                    <h2>Block comparison</h2>
                    <span className="fine">
                      Partial months reflect selected dates
                    </span>
                  </div>
                  <BlockTable rows={a.comparison} />
                </div>
              </>
            )}
            {page === "holiday" && <HolidayPlanning filters={filters} />}
            {page === "security" && (
              <>
                <div className="panel table-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Security alerts</h2>
                      <p>
                        Five failures at one gate within a rolling two-minute
                        window
                      </p>
                    </div>
                    <Badge
                      tone={
                        a.alerts.some((x) => x.status !== "resolved")
                          ? "danger"
                          : "success"
                      }
                    >
                      {a.alerts.filter((x) => x.status !== "resolved").length}{" "}
                      active
                    </Badge>
                  </div>
                  <div className="notice warning">
                    An alert requests human review. It is not proof of criminal
                    activity. Every unauthorised attempt is denied immediately.
                  </div>
                  {a.alerts.map((al) => (
                    <div className="alert-row" key={al.id}>
                      <ShieldAlert size={22} />
                      <div>
                        <strong>
                          {blockLabel(s.data.blocks, al.block_id)}
                        </strong>
                        <p>{al.description}</p>
                        <small>
                          {dayKey(al.timestamp)} · {timeLabel(al.timestamp)} MYT
                        </small>
                      </div>
                      <select
                        aria-label={`Alert status ${al.id}`}
                        value={al.status}
                        onChange={async (e) => {
                          try {
                            await s.updateAlert(
                              al.id,
                              e.target.value as
                                "new" | "under_review" | "resolved",
                            );
                          } catch (e) {
                            setMessage((e as Error).message);
                          }
                        }}
                      >
                        <option value="new">New</option>
                        <option value="under_review">Under Review</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  ))}
                  {!a.alerts.length && (
                    <p className="empty-state">
                      No alerts in the selected range.
                    </p>
                  )}
                </div>
                <section className="panel table-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent verification events</h2>
                      <p>Operational feed · personal identities minimised</p>
                    </div>
                    <Badge>Latest 50</Badge>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Outcome</th>
                          <th>Residential block</th>
                          <th>Timestamp (MYT)</th>
                          <th>Verification note</th>
                          <th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.events.slice(0, 50).map((e) => (
                          <tr key={e.id}>
                            <td>
                              <Badge tone={e.granted ? "success" : "danger"}>
                                {e.granted ? "Granted" : "Denied"}
                              </Badge>
                            </td>
                            <td>{blockLabel(s.data.blocks, e.block_id)}</td>
                            <td className="mono">
                              {dayKey(e.timestamp)} {timeLabel(e.timestamp)}
                            </td>
                            <td>
                              {e.denial_reason ??
                                "Active residential permission"}
                            </td>
                            <td>
                              {e.verification_method.replaceAll("_", " ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!a.events.length && (
                    <p className="empty-state">No verification events yet.</p>
                  )}
                </section>
                {!s.connected && (
                  <div className="panel demo-dashboard">
                    <div>
                      <strong>Standalone security scenario</strong>
                      <p>
                        Generate five failures in this dashboard’s local
                        dataset.
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={async () => {
                        for (let i = 0; i < 5; i++)
                          await s.scenario(
                            4,
                            filters.block || s.data.blocks[0].id,
                          );
                        setMessage(
                          "Five failures recorded locally. Alert cooldown prevents duplicates.",
                        );
                      }}
                    >
                      Run five failures
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
            {page === "records" && detail ? (
              <StudentDetail
                key={detail.id}
                student={detail}
                onBack={() => navigate("records")}
                onEdit={() => setEdit({ ...detail })}
              />
            ) : (
              page === "records" && (
                <>
                  <div className="notice">
                    <ShieldCheck size={18} />
                    Permission changes affect subsequent verification.{" "}
                    {s.connected
                      ? "Updates are validated and audited on the server."
                      : "Local edits affect this app only; use the permission test below to demonstrate."}
                  </div>
                  <section className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Fictional residential records</h2>
                        <p>{records.length} students · Demo Data</p>
                      </div>
                      <div className="search-field">
                        <Search size={16} />
                        <input
                          aria-label="Search residents"
                          placeholder="Search name or student ID"
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setRecordPage(0);
                          }}
                        />
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Student ID</th>
                            <th>Year</th>
                            <th>Residential block</th>
                            <th>Room</th>
                            <th>Permission</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {records
                            .slice(recordPage * 12, recordPage * 12 + 12)
                            .map((st) => (
                              <tr key={st.id}>
                                <td>
                                  <div className="table-person">
                                    <span className="table-avatar">
                                      {st.name
                                        .split(" ")
                                        .slice(0, 2)
                                        .map((n) => n[0])
                                        .join("")}
                                    </span>
                                    <strong>{st.name}</strong>
                                  </div>
                                </td>
                                <td className="mono">{st.student_id}</td>
                                <td>Year {st.year_of_study}</td>
                                <td>
                                  {blockLabel(s.data.blocks, st.block_id)}
                                </td>
                                <td>{st.room_number ?? "—"}</td>
                                <td>
                                  <Badge tone={statusTone(st.status)}>
                                    {st.status === "none"
                                      ? "No permission"
                                      : st.status}
                                  </Badge>
                                </td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => openDetail(st.id)}
                                  >
                                    View details <ArrowRight size={13} />
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => setEdit({ ...st })}
                                  >
                                    Edit permission
                                    <ArrowUpRight size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-pagination">
                      <span>
                        Showing {Math.min(recordPage * 12 + 1, records.length)}–
                        {Math.min(recordPage * 12 + 12, records.length)} of{" "}
                        {records.length}
                      </span>
                      <div>
                        <button
                          className="button small"
                          disabled={recordPage === 0}
                          onClick={() => setRecordPage(recordPage - 1)}
                        >
                          Previous
                        </button>
                        <button
                          className="button small"
                          disabled={(recordPage + 1) * 12 >= records.length}
                          onClick={() => setRecordPage(recordPage + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </section>
                  {!s.connected && (
                    <div className="panel demo-dashboard">
                      <div>
                        <strong>
                          Test Alex’s updated permission at KK3 Block A
                        </strong>
                        <p>
                          Run this after activating, expiring, or moving Alex to
                          another block.
                        </p>
                      </div>
                      <button
                        className="button"
                        onClick={async () => {
                          const r = await s.scenario(0, s.data.blocks[0].id);
                          setMessage(
                            `${r.granted ? "ACCESS GRANTED" : "ACCESS DENIED"} · ${r.reason}`,
                          );
                        }}
                      >
                        Test permission
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </>
              )
            )}
            <footer className="dashboard-footer">
              <span>
                <ShieldCheck size={13} />
                KK Smart · Responsible residential intelligence
              </span>
              <span>Demo Data · TEF 2026 · MYT (UTC+8)</span>
            </footer>
            {!s.connected && (
              <div className="reset-row">
                <button
                  className="text-button"
                  onClick={() => {
                    s.reset();
                    setMessage("Local demo dataset restored.");
                  }}
                >
                  <RefreshCw size={13} />
                  Reset dashboard demo
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
      {edit && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-title"
          >
            <div className="panel-heading">
              <div>
                <div className="eyebrow">RESIDENTIAL PERMISSION</div>
                <h2 id="permission-title">{edit.name}</h2>
                <p>{edit.student_id}</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setEdit(null)}
              >
                <X size={19} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  await s.updateStudent(edit);
                  setEdit(null);
                  setMessage(
                    "Residential permission saved. Subsequent verification uses this permission.",
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label>
                Status
                <select
                  value={edit.status}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      status: e.target.value as Student["status"],
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="none">No permission</option>
                </select>
              </label>
              <label>
                Assigned block
                <select
                  required={edit.status !== "none"}
                  value={edit.block_id ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, block_id: e.target.value || null })
                  }
                >
                  <option value="">No allocation</option>
                  {s.data.blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {blockLabel(s.data.blocks, b.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Room number
                <input
                  required={edit.status === "active"}
                  maxLength={30}
                  value={edit.room_number ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, room_number: e.target.value })
                  }
                />
              </label>
              <label>
                Permission end date
                <input
                  type="date"
                  required={edit.status === "active"}
                  min={edit.status === "active" ? dayOffset(0) : undefined}
                  value={edit.end_date ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, end_date: e.target.value })
                  }
                />
              </label>
              <p className="fine">
                To reactivate an expired record, select a future end date.
              </p>
              <button className="button primary" disabled={saving}>
                {saving ? "Saving…" : "Save permission"}
                <Check size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function BlockTable({
  rows,
}: {
  rows: ReturnType<typeof analytics>["comparison"];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Residential block</th>
            <th>Registered residents</th>
            <th>Declared stays</th>
            <th>% declaring stay</th>
            <th>Recent unique entrants</th>
            <th>Successful entries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.label}</strong>
              </td>
              <td>{b.residents}</td>
              <td>{b.stays}</td>
              <td>
                <span className="percentage-bar">
                  <i style={{ width: `${b.percentage}%` }} />
                </span>
                {b.percentage}%
              </td>
              <td>{b.entrants}</td>
              <td>{b.granted.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default Management;
