import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGES = [
  { key: "PENDING_DEPOSIT", label: "Detected", icon: "fa-magnifying-glass" },
  { key: "DEPOSIT_CREDITED", label: "Deposited", icon: "fa-building-columns" },
  { key: "CONVERTING", label: "Converting", icon: "fa-arrows-rotate" },
  { key: "CONVERTED", label: "Converted", icon: "fa-check-double" },
  { key: "WITHDRAWING", label: "Withdrawing", icon: "fa-paper-plane" },
  { key: "COMPLETED", label: "Complete", icon: "fa-circle-check" },
];

const STATUS_COLORS = {
  PENDING_DEPOSIT: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/40" },
  DEPOSIT_CREDITED: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40" },
  CONVERTING: { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-500/40" },
  CONVERTED: { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/40" },
  WITHDRAWING: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/40" },
  COMPLETED: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
  FAILED: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
};

const STATUS_ORDER = ["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING", "COMPLETED"];

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING_DEPOSIT;
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ProgressPipeline({ status }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  const isFailed = status === "FAILED";

  return (
    <div data-testid="conversion-pipeline" className="flex items-center gap-1 w-full">
      {STAGES.map((stage, idx) => {
        const isCompleted = !isFailed && idx <= currentIdx;
        const isActive = !isFailed && idx === currentIdx;
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs transition-all duration-300
              ${isFailed ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                isCompleted ? "bg-emerald-500 text-white" :
                isActive ? "bg-amber-500 text-white animate-pulse" :
                "bg-zinc-800 text-zinc-500 border border-zinc-700"}
            `}>
              <i className={`fa-solid ${isFailed && idx === currentIdx ? "fa-xmark" : stage.icon} text-[10px]`} />
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300
                ${!isFailed && idx < currentIdx ? "bg-emerald-500" : "bg-zinc-800"}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConversionRow({ conversion, onSelect }) {
  const sourceAmt = parseFloat(conversion.source_amount || 0);
  const payoutAmt = parseFloat(conversion.merchant_payout_usd || conversion.target_amount || 0);
  const created = new Date(conversion.createdAt);
  const timeAgo = getTimeAgo(created);

  return (
    <tr
      data-testid={`conversion-row-${conversion.conversion_id}`}
      onClick={() => onSelect(conversion.conversion_id)}
      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm font-mono text-zinc-300">#{conversion.conversion_id}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{sourceAmt.toFixed(6)}</span>
          <span className="text-xs text-zinc-500">{conversion.source_currency}</span>
          <i className="fa-solid fa-arrow-right text-[10px] text-zinc-600 mx-1" />
          <span className="text-sm font-medium text-emerald-400">${payoutAmt.toFixed(2)}</span>
          <span className="text-xs text-zinc-500">{conversion.target_currency}</span>
        </div>
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        <ProgressPipeline status={conversion.status} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={conversion.status} />
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo}</td>
    </tr>
  );
}

function ConversionDetail({ conversionId, token, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversionId) return;
    setLoading(true);
    axios
      .get(`${API}/dashboard/conversions/${conversionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setDetail(res.data.data))
      .catch((err) => console.error("Detail fetch error:", err))
      .finally(() => setLoading(false));
  }, [conversionId, token]);

  if (loading) {
    return (
      <div data-testid="conversion-detail-loading" className="flex items-center justify-center py-12">
        <i className="fa-solid fa-spinner fa-spin text-zinc-500 text-xl" />
      </div>
    );
  }

  if (!detail) return null;

  const { conversion, timeline, fee_breakdown } = detail;

  return (
    <div data-testid="conversion-detail-panel" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-100">
          Conversion #{conversion.conversion_id}
        </h3>
        <button data-testid="detail-close-btn" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <i className="fa-solid fa-xmark text-lg" />
        </button>
      </div>

      {/* Timeline */}
      <div data-testid="conversion-timeline" className="space-y-3">
        {timeline.map((step, idx) => (
          <div key={step.stage} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs
                ${detail.is_failed && step.active ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                  step.completed ? "bg-emerald-500 text-white" :
                  step.active ? "bg-amber-500 text-white animate-pulse" :
                  "bg-zinc-800 text-zinc-500 border border-zinc-700"}
              `}>
                <i className={`fa-solid ${STAGES[idx]?.icon || "fa-circle"}`} />
              </div>
              {idx < timeline.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 ${step.completed ? "bg-emerald-500/50" : "bg-zinc-800"}`} />
              )}
            </div>
            <div className="pt-1">
              <p className={`text-sm font-medium ${step.completed || step.active ? "text-zinc-200" : "text-zinc-500"}`}>
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {new Date(step.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fee Breakdown */}
      {(conversion.status === "COMPLETED" || conversion.status === "WITHDRAWING") && (
        <div data-testid="fee-breakdown" className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Fee Breakdown</h4>
          <FeeRow label="Gross Sale" value={fee_breakdown.gross_sale_usd} />
          <FeeRow label="Platform Fee" value={-fee_breakdown.platform_fee_usd} negative />
          <FeeRow label="Sweep Gas" value={-fee_breakdown.sweep_gas_fee_usd} negative />
          <FeeRow label="Trade Fee" value={-fee_breakdown.trade_fee_usd} negative />
          <FeeRow label="Withdrawal Fee" value={-fee_breakdown.withdrawal_fee_usd} negative />
          <div className="border-t border-zinc-700 pt-2 mt-2">
            <FeeRow label="Net Payout" value={fee_breakdown.net_payout_usd} highlight />
          </div>
        </div>
      )}

      {/* Error message */}
      {detail.is_failed && conversion.error_message && (
        <div data-testid="conversion-error" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400"><i className="fa-solid fa-triangle-exclamation mr-2" />{conversion.error_message}</p>
        </div>
      )}

      {/* TX Hash Links */}
      <div className="space-y-2">
        {conversion.deposit_tx_hash && (
          <TxLink label="Sweep TX" hash={conversion.deposit_tx_hash} />
        )}
        {conversion.withdrawal_tx_hash && (
          <TxLink label="Withdrawal TX" hash={conversion.withdrawal_tx_hash} />
        )}
      </div>
    </div>
  );
}

function FeeRow({ label, value, negative, highlight }) {
  const formatted = Math.abs(value).toFixed(2);
  return (
    <div className="flex justify-between text-sm">
      <span className={highlight ? "text-zinc-200 font-medium" : "text-zinc-400"}>{label}</span>
      <span className={
        highlight ? "text-emerald-400 font-semibold" :
        negative && value !== 0 ? "text-red-400" : "text-zinc-300"
      }>
        {negative && value !== 0 ? "-" : ""}${formatted}
      </span>
    </div>
  );
}

function TxLink({ label, hash }) {
  const short = hash ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}` : "";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500">{label}:</span>
      <span className="font-mono text-zinc-400">{short}</span>
    </div>
  );
}

function StatusFilter({ active, onSelect, summary }) {
  const filters = [
    { key: "", label: "All", count: Object.values(summary).reduce((a, b) => a + b, 0) },
    { key: "PENDING_DEPOSIT", label: "Pending" },
    { key: "CONVERTING", label: "Converting" },
    { key: "WITHDRAWING", label: "Withdrawing" },
    { key: "COMPLETED", label: "Completed" },
    { key: "FAILED", label: "Failed" },
  ];

  return (
    <div data-testid="status-filter" className="flex gap-2 flex-wrap">
      {filters.map((f) => {
        const count = f.key ? (summary[f.key] || 0) : f.count;
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            data-testid={`filter-${f.key || "all"}`}
            onClick={() => onSelect(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isActive ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"}
            `}
          >
            {f.label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-zinc-900 text-zinc-100" : "bg-zinc-700 text-zinc-400"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ConversionTracker() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [conversions, setConversions] = useState([]);
  const [statusSummary, setStatusSummary] = useState({});
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const login = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await axios.post(`${API}/user/login`, { email, password });
      setToken(res.data.data?.token || res.data.token);
    } catch (err) {
      setLoginError(err.response?.data?.message || "Login failed");
    }
  };

  const fetchConversions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get(`${API}/dashboard/conversions`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setConversions(res.data.data?.conversions || []);
      setStatusSummary(res.data.data?.status_summary || {});
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!autoRefresh || !token) return;
    const interval = setInterval(fetchConversions, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, token, fetchConversions]);

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <form data-testid="login-form" onSubmit={login} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="text-center mb-2">
            <h1 className="text-xl font-bold text-zinc-100">DynoPay</h1>
            <p className="text-xs text-zinc-500 mt-1">Conversion Status Tracker</p>
          </div>
          {loginError && <p data-testid="login-error" className="text-red-400 text-sm text-center">{loginError}</p>}
          <input
            data-testid="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <input
            data-testid="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <button
            data-testid="login-submit"
            type="submit"
            className="w-full py-2.5 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-semibold hover:bg-white transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div data-testid="conversion-tracker-page" className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Header */}
      <header className="border-b border-zinc-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Conversion Tracker</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time crypto-to-stablecoin pipeline status</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="auto-refresh-toggle"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${autoRefresh ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500"}
              `}
            >
              <i className={`fa-solid ${autoRefresh ? "fa-signal" : "fa-pause"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              data-testid="refresh-btn"
              onClick={fetchConversions}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Status Filters */}
        <StatusFilter active={statusFilter} onSelect={setStatusFilter} summary={statusSummary} />

        <div className="flex gap-6">
          {/* Conversion Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <table data-testid="conversions-table" className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Pipeline</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-600 text-sm">
                        {loading ? (
                          <i className="fa-solid fa-spinner fa-spin text-xl" />
                        ) : (
                          <>No conversions found{statusFilter ? ` with status "${statusFilter.replace(/_/g, " ")}"` : ""}</>
                        )}
                      </td>
                    </tr>
                  ) : (
                    conversions.map((c) => (
                      <ConversionRow
                        key={c.conversion_id}
                        conversion={c}
                        onSelect={setSelectedId}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedId && (
            <div className="w-[380px] flex-shrink-0">
              <ConversionDetail
                conversionId={selectedId}
                token={token}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
