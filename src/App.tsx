import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OverviewTab } from './components/OverviewTab';
import { BundlesTab } from './components/BundlesTab';
import { AIRegistryTab } from './components/AIRegistryTab';
import { RolesTasksTab } from './components/RolesTasksTab';
import { MemoryContextTab } from './components/MemoryContextTab';
import { CircuitSchedulerTab } from './components/CircuitSchedulerTab';
import { SessionsPlaygroundTab } from './components/SessionsPlaygroundTab';
import { SystemLogsTab } from './components/SystemLogsTab';
import { SystemInsightsTab } from './components/SystemInsightsTab';
import {
  ThemeMode,
  Provider,
  Harness,
  AIModel,
  ConfigBundle,
  SystemRole,
  PromptTemplate,
  TaskDefinition,
  InspectorTaskDispatch,
  FailureRecoveryConfig,
  AgentScheduleEntry,
  SessionLedger,
  ValidationReport
} from './types';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('steel');
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Subsystem States
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [harnesses, setHarnesses] = useState<Harness[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [bundles, setBundles] = useState<ConfigBundle[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [inspectorDispatch, setInspectorDispatch] = useState<InspectorTaskDispatch[]>([]);
  const [failureConfig, setFailureConfig] = useState<FailureRecoveryConfig>({
    max_retries_per_model: 3,
    retry_delay_seconds: 5,
    max_fallbacks: 2,
    push_back_to_pending: true,
    circuit_breaker_retry_after: 60
  });
  const [schedules, setSchedules] = useState<AgentScheduleEntry[]>([]);
  const [sessions, setSessions] = useState<SessionLedger[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isRefreshingMemory, setIsRefreshingMemory] = useState<boolean>(false);

  // Synchronize theme attribute on html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initial Data Fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // 1. Health check
      fetch('/health')
        .then(r => r.json())
        .then(d => {
          setIsOnline(true);
          setHealthStatus(d);
        })
        .catch(() => setIsOnline(false));

      // 2. Parallel fetches
      const [
        resProv,
        resHarn,
        resMod,
        resBund,
        resRoles,
        resPrompts,
        resTasks,
        resDisp,
        resFail,
        resSched,
        resSess,
        resVal
      ] = await Promise.all([
        fetch('/config/ai/providers').then(r => r.json()).catch(() => []),
        fetch('/config/ai/harnesses').then(r => r.json()).catch(() => []),
        fetch('/config/ai/models').then(r => r.json()).catch(() => []),
        fetch('/config/ai/bundles').then(r => r.json()).catch(() => []),
        fetch('/roles').then(r => r.json()).catch(() => []),
        fetch('/prompts').then(r => r.json()).catch(() => []),
        fetch('/tasks').then(r => r.json()).catch(() => []),
        fetch('/tasks/inspector/dispatch').then(r => r.json()).catch(() => []),
        fetch('/config/failure-recovery').then(r => r.json()).catch(() => null),
        fetch('/scheduler').then(r => r.json()).catch(() => []),
        fetch('/sessions').then(r => r.json()).catch(() => []),
        fetch('/config/ai/validate').then(r => r.json()).catch(() => null)
      ]);

      setProviders(Array.isArray(resProv) ? resProv : []);
      setHarnesses(Array.isArray(resHarn) ? resHarn : []);
      setModels(Array.isArray(resMod) ? resMod : []);
      setBundles(Array.isArray(resBund) ? resBund : []);
      setRoles(Array.isArray(resRoles?.roles) ? resRoles.roles : Array.isArray(resRoles) ? resRoles : []);
      setPrompts(Array.isArray(resPrompts?.prompts) ? resPrompts.prompts : Array.isArray(resPrompts) ? resPrompts : []);
      setTasks(Array.isArray(resTasks?.tasks) ? resTasks.tasks : Array.isArray(resTasks) ? resTasks : []);
      setInspectorDispatch(Array.isArray(resDisp?.tasks) ? resDisp.tasks : Array.isArray(resDisp) ? resDisp : []);
      if (resFail) setFailureConfig(resFail);
      setSchedules(Array.isArray(resSched?.entries) ? resSched.entries : Array.isArray(resSched) ? resSched : []);
      setSessions(Array.isArray(resSess) ? resSess : []);
      if (resVal) setValidationReport(resVal);
    } catch (e) {
      console.error('Error loading tackle state:', e);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Re-validate integrity report
  const handleValidateIntegrity = async () => {
    try {
      const res = await fetch('/config/ai/validate');
      if (res.ok) {
        const report = await res.json();
        setValidationReport(report);
      }
    } catch (e) {
      console.error('Validation error:', e);
    }
  };

  // Memory Refresh Proxy
  const handleRefreshMemory = async () => {
    setIsRefreshingMemory(true);
    try {
      await fetch('/memory/refresh', { method: 'POST' });
    } catch (e) {
      console.error('Memory sync error:', e);
    } finally {
      setTimeout(() => setIsRefreshingMemory(false), 800);
    }
  };

  // Seed Defaults
  const handleSeedDefaults = async () => {
    if (confirm('Reset and re-seed default tackle configurations?')) {
      try {
        await fetch('/config/ai/seed-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: false }) });
        await fetchAllData();
      } catch (e) {
        alert('Seed error');
      }
    }
  };

  // Bundle CRUD Actions
  const handleSaveBundle = async (bundle: Partial<ConfigBundle>) => {
    const res = await fetch('/config/ai/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle)
    });
    if (res.ok) {
      const updatedBundles = await fetch('/config/ai/bundles').then(r => r.json());
      setBundles(updatedBundles);
      handleValidateIntegrity();
    }
  };

  const handleDeleteBundle = async (id: string) => {
    const res = await fetch(`/config/ai/bundle/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBundles(prev => prev.filter(b => b.id !== id));
      handleValidateIntegrity();
    }
  };

  const handleReorderPriority = async (role: string, bundleId: string, direction: 'up' | 'down') => {
    const roleBundles = bundles.filter(b => b.role === role).sort((a, b) => a.priority - b.priority);
    const index = roleBundles.findIndex(b => b.id === bundleId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= roleBundles.length) return;

    // Swap priorities
    const currentBundle = { ...roleBundles[index] };
    const targetBundle = { ...roleBundles[targetIndex] };

    const tempPriority = currentBundle.priority;
    currentBundle.priority = targetBundle.priority;
    targetBundle.priority = tempPriority;

    await Promise.all([
      fetch('/config/ai/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentBundle)
      }),
      fetch('/config/ai/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetBundle)
      })
    ]);

    const updatedBundles = await fetch('/config/ai/bundles').then(r => r.json());
    setBundles(updatedBundles);
  };

  // Provider CRUD
  const handleSaveProvider = async (prov: Partial<Provider>) => {
    await fetch('/config/ai/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prov)
    });
    const updated = await fetch('/config/ai/providers').then(r => r.json());
    setProviders(updated);
  };

  const handleDeleteProvider = async (id: string) => {
    await fetch(`/config/ai/provider/${id}`, { method: 'DELETE' });
    setProviders(prev => prev.filter(p => p.id !== id));
  };

  // Harness CRUD
  const handleSaveHarness = async (harn: Partial<Harness>) => {
    await fetch('/config/ai/harness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(harn)
    });
    const updated = await fetch('/config/ai/harnesses').then(r => r.json());
    setHarnesses(updated);
  };

  const handleDeleteHarness = async (id: string) => {
    await fetch(`/config/ai/harness/${id}`, { method: 'DELETE' });
    setHarnesses(prev => prev.filter(h => h.id !== id));
  };

  // Model CRUD
  const handleSaveModel = async (mod: Partial<AIModel>) => {
    await fetch('/config/ai/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mod)
    });
    const updated = await fetch('/config/ai/models').then(r => r.json());
    setModels(updated);
  };

  const handleDeleteModel = async (id: string) => {
    await fetch(`/config/ai/model/${id}`, { method: 'DELETE' });
    setModels(prev => prev.filter(m => m.id !== id));
  };

  // Role CRUD
  const handleSaveRole = async (role: Partial<SystemRole>) => {
    await fetch('/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role)
    });
    const updated = await fetch('/roles').then(r => r.json());
    setRoles(Array.isArray(updated?.roles) ? updated.roles : updated);
  };

  const handleDeleteRole = async (id: string) => {
    await fetch(`/roles/${id}`, { method: 'DELETE' });
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  // Prompt & Task CRUD
  const handleSavePrompt = async (prompt: Partial<PromptTemplate>) => {
    await fetch('/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    });
    const updated = await fetch('/prompts').then(r => r.json());
    setPrompts(Array.isArray(updated?.prompts) ? updated.prompts : Array.isArray(updated) ? updated : []);
  };

  const handleSaveTask = async (task: Partial<TaskDefinition>) => {
    await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    const [updatedTasks, updatedDisp] = await Promise.all([
      fetch('/tasks').then(r => r.json()),
      fetch('/tasks/inspector/dispatch').then(r => r.json())
    ]);
    setTasks(Array.isArray(updatedTasks?.tasks) ? updatedTasks.tasks : Array.isArray(updatedTasks) ? updatedTasks : []);
    setInspectorDispatch(Array.isArray(updatedDisp?.tasks) ? updatedDisp.tasks : Array.isArray(updatedDisp) ? updatedDisp : []);
  };

  // Failure Recovery
  const handleSaveFailureConfig = async (config: FailureRecoveryConfig) => {
    await fetch('/config/failure-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setFailureConfig(config);
  };

  // Schedule CRUD
  const handleSaveSchedule = async (sched: Partial<AgentScheduleEntry>) => {
    await fetch('/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sched)
    });
    const updated = await fetch('/scheduler').then(r => r.json());
    setSchedules(Array.isArray(updated?.entries) ? updated.entries : Array.isArray(updated) ? updated : []);
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    await fetch(`/scheduler/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    setSchedules(prev => prev.map(s => (s.id === id ? { ...s, enabled } : s)));
  };

  const handleDeleteSchedule = async (id: string) => {
    await fetch(`/scheduler/${id}`, { method: 'DELETE' });
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Kill Session
  const handleKillSession = async (sessionId: string) => {
    await fetch(`/sessions/${sessionId}/kill`, { method: 'POST' });
    const updated = await fetch('/sessions').then(r => r.json());
    setSessions(updated);
  };

  // Run Test Payload
  const handleRunTest = async (role: string, modelId: string, promptText: string) => {
    const res = await fetch('/config/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: modelId,
        test_prompt: promptText
      })
    });
    return await res.json();
  };

  const activeSessionsCount = sessions.filter(s => s.status === 'running').length;

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-6 font-mono text-xs">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 border-2 border-[var(--accent-color)] border-t-transparent animate-spin rounded-full mx-auto" />
          <div className="text-sm font-bold tracking-tight animate-pulse">
            Bootstrapping Tackle Subsystem State & REST REST API...
          </div>
          <p className="text-[var(--text-muted)] text-[11px]">
            Connecting to PostgreSQL schema on port 3410
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200 flex flex-col">
      <Header
        theme={theme}
        setTheme={setTheme}
        isOnline={isOnline}
        activeSessionCount={activeSessionsCount}
        healthStatus={healthStatus}
        onRefreshMemory={handleRefreshMemory}
        isRefreshingMemory={isRefreshingMemory}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {currentTab === 'overview' && (
              <OverviewTab
                roles={roles}
                models={models}
                providers={providers}
                harnesses={harnesses}
                bundles={bundles}
                validationReport={validationReport}
                onValidate={handleValidateIntegrity}
                onRunTest={(role, modelId, prompt) => handleRunTest(role, modelId, prompt)}
                onSeedDefaults={handleSeedDefaults}
                onNavigateToTab={setCurrentTab}
              />
            )}

            {currentTab === 'bundles' && (
              <BundlesTab
                bundles={bundles}
                models={models}
                providers={providers}
                harnesses={harnesses}
                roles={roles}
                onSaveBundle={handleSaveBundle}
                onDeleteBundle={handleDeleteBundle}
                onReorderPriority={handleReorderPriority}
              />
            )}

            {currentTab === 'registry' && (
              <AIRegistryTab
                providers={providers}
                harnesses={harnesses}
                models={models}
                onSaveProvider={handleSaveProvider}
                onDeleteProvider={handleDeleteProvider}
                onSaveHarness={handleSaveHarness}
                onDeleteHarness={handleDeleteHarness}
                onSaveModel={handleSaveModel}
                onDeleteModel={handleDeleteModel}
              />
            )}

            {currentTab === 'roles-tasks' && (
              <RolesTasksTab
                roles={roles}
                prompts={prompts}
                tasks={tasks}
                inspectorDispatch={inspectorDispatch}
                onSaveRole={handleSaveRole}
                onDeleteRole={handleDeleteRole}
                onSavePrompt={handleSavePrompt}
                onSaveTask={handleSaveTask}
              />
            )}

            {currentTab === 'memory' && (
              <MemoryContextTab
                roles={roles}
                onRefreshMemory={handleRefreshMemory}
                isRefreshingMemory={isRefreshingMemory}
              />
            )}

            {currentTab === 'circuit-sched' && (
              <CircuitSchedulerTab
                failureConfig={failureConfig}
                onSaveFailureConfig={handleSaveFailureConfig}
                schedules={schedules}
                roles={roles}
                models={models}
                onSaveSchedule={handleSaveSchedule}
                onToggleSchedule={handleToggleSchedule}
                onDeleteSchedule={handleDeleteSchedule}
              />
            )}

            {currentTab === 'sessions-playground' && (
              <SessionsPlaygroundTab
                sessions={sessions}
                roles={roles}
                models={models}
                onKillSession={handleKillSession}
                onRunTest={handleRunTest}
              />
            )}

            {currentTab === 'system-logs' && (
              <SystemLogsTab />
            )}

            {currentTab === 'system-insights' && (
              <SystemInsightsTab initialHealthStatus={healthStatus} />
            )}
          </main>

          <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-4 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[var(--text-muted)] gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Tackle Subsystem REST Server :3410</span>
                <span>•</span>
                <span>Role Memory Cache :3500</span>
              </div>
              <div>
                <span>PostgreSQL `tackle` Schema • Gemini Server SDK Proxy</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
