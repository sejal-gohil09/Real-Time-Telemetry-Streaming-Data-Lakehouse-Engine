import { useState, useMemo } from 'react';
import { Radio, Pause, Play, ChevronRight, Search } from 'lucide-react';
import { getTopics, formatTimeAgo, type StreamEvent } from '@/lib/telemetry';

interface EventStreamsProps {
  events: StreamEvent[];
}

const CATEGORY_COLORS: Record<string, string> = {
  telemetry: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  events: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  logs: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  metrics: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  traces: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const CATEGORIES = ['telemetry', 'events', 'logs', 'metrics', 'traces'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  telemetry: 'Telemetry',
  events: 'Events',
  logs: 'Logs',
  metrics: 'Metrics',
  traces: 'Traces',
};

export function EventStreams({ events }: EventStreamsProps) {
  const topics = useMemo(() => getTopics(), []);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<StreamEvent | null>(null);

  const topicCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    topics.forEach((t) => { map[t.name] = t.category; });
    return map;
  }, [topics]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedTopic && e.topic !== selectedTopic) return false;
      if (selectedCategory && topicCategoryMap[e.topic] !== selectedCategory) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.key.toLowerCase().includes(s) ||
          e.topic.toLowerCase().includes(s) ||
          JSON.stringify(e.payload).toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [events, selectedTopic, selectedCategory, search, topicCategoryMap]);

  const visibleTopics = useMemo(() => {
    if (!selectedCategory) return topics;
    return topics.filter((t) => t.category === selectedCategory);
  }, [topics, selectedCategory]);

  const totalThroughput = topics.reduce((sum, t) => sum + t.throughput, 0);
  const totalLag = topics.reduce((sum, t) => sum + t.lag, 0);
  const totalPartitions = topics.reduce((sum, t) => sum + t.partitions, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Total Topics</p>
          <p className="text-2xl font-bold text-white font-mono mt-1">{topics.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Total Throughput</p>
          <p className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {(totalThroughput / 1000).toFixed(1)}K<span className="text-xs text-slate-500 ml-1">msg/s</span>
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Consumer Lag</p>
          <p className={`text-2xl font-bold font-mono mt-1 ${totalLag > 5000 ? 'text-red-400' : totalLag > 500 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {totalLag.toLocaleString()}
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Partitions</p>
          <p className="text-2xl font-bold text-white font-mono mt-1">{totalPartitions}</p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            selectedCategory === null
              ? 'bg-slate-700 text-white border-slate-600'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
          }`}
        >
          All Categories
        </button>
        {CATEGORIES.map((cat) => {
          const count = topics.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedCategory === cat
                  ? `${CATEGORY_COLORS[cat]} border-current`
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span className="ml-1.5 text-[10px] text-slate-500 font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Topic list */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            Topics
          </h3>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            <button
              onClick={() => setSelectedTopic(null)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                selectedTopic === null
                  ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>All topics</span>
                <span className="text-xs text-slate-600 font-mono">{visibleTopics.length}</span>
              </div>
            </button>
            {visibleTopics.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTopic(t.name)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  selectedTopic === t.name
                    ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-mono text-xs">{t.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[t.category]}`}>
                    {t.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600 font-mono">
                  <span>{t.partitions}p</span>
                  <span>{(t.throughput / 1000).toFixed(1)}K/s</span>
                  <span className={t.lag > 1000 ? 'text-red-400' : t.lag > 100 ? 'text-amber-400' : ''}>
                    lag: {t.lag}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Event feed */}
        <div className="lg:col-span-6 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">
                {selectedTopic || (selectedCategory ? `${CATEGORY_LABELS[selectedCategory]} Events` : 'All Events')}
              </h3>
              <span className="text-xs text-slate-500 font-mono">{filteredEvents.length} events</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter..."
                  className="bg-slate-800/60 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-32 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>
              <button
                onClick={() => setPaused(!paused)}
                className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
                No events matching filter
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {filteredEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors flex items-center gap-3 text-xs font-mono ${
                      selectedEvent?.id === e.id ? 'bg-slate-800/60' : ''
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        e.status === 'error' ? 'bg-red-500' : e.status === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-slate-600 w-16">{new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                    <span className="text-slate-500 w-20 truncate">{e.topic.split('.').pop()}</span>
                    <span className="text-slate-400 w-10">p{e.partition}</span>
                    <span className="text-slate-300 flex-1 truncate">{e.key}</span>
                    <span className={`shrink-0 ${e.latencyMs > 100 ? 'text-red-400' : e.latencyMs > 50 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {e.latencyMs}ms
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Event detail */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Event Detail</h3>
          {selectedEvent ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Topic</p>
                <p className="text-xs text-cyan-400 font-mono break-all">{selectedEvent.topic}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Partition</p>
                  <p className="text-xs text-white font-mono">{selectedEvent.partition}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Offset</p>
                  <p className="text-xs text-white font-mono">{selectedEvent.offset}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Key</p>
                  <p className="text-xs text-white font-mono break-all">{selectedEvent.key}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Latency</p>
                  <p className={`text-xs font-mono ${selectedEvent.latencyMs > 100 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedEvent.latencyMs}ms
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Timestamp</p>
                <p className="text-xs text-slate-400 font-mono">{formatTimeAgo(selectedEvent.timestamp)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Payload</p>
                <pre className="text-xs text-slate-300 font-mono bg-slate-950 rounded-lg p-3 overflow-x-auto border border-slate-800">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <span
                  className={`text-xs px-2 py-1 rounded border font-mono ${
                    selectedEvent.status === 'error'
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : selectedEvent.status === 'warn'
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}
                >
                  {selectedEvent.status.toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-xs">
              Select an event to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
