import { useState, useEffect, useCallback } from 'react';
import { Atom } from 'lucide-react';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { SIM_REGISTRY } from './physics/registry';
import { SimGrid } from './physics/SimGrid';
import { SimSliders } from './physics/SimSliders';
import { SimCanvas } from './physics/SimCanvas';
import { PhETEmbed } from './physics/PhETEmbed';
import { CustomSimModal } from './physics/CustomSimModal';
import { NotesPanel } from './physics/NotesPanel';
import { SimHelpPanel } from './physics/SimHelpPanel';
import type { SimDef } from './physics/types';
import { createCustomSimClass } from './physics/sims/CustomSim';

function PhysicsSimTool() {
  console.log('[PhysicsSim] render');
  const [activeSimId, setActiveSimId] = useState('electric-field');
  const [params, setParams] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [runtimeSims, setRuntimeSims] = useState<SimDef[]>([]);

  // Load saved custom sims from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nousai-custom-sims') || '[]');
      const loaded: SimDef[] = saved.map((s: any) => ({
        id: s.id,
        title: s.name,
        subtitle: s.equation,
        type: 'canvas' as const,
        sliders: s.sliders,
        sim: createCustomSimClass(s.equation),
      }));
      setRuntimeSims(loaded);
    } catch { /* ignore */ }
  }, []);

  const allSims = [...SIM_REGISTRY, ...runtimeSims];
  const activeSim = allSims.find(s => s.id === activeSimId) ?? SIM_REGISTRY[0];

  // Initialize params from slider defaults when sim changes
  useEffect(() => {
    if (activeSim.sliders) {
      const defaults: Record<string, number> = {};
      activeSim.sliders.forEach(s => { defaults[s.key] = s.default; });
      setParams(defaults);
    }
    setRunning(false);
  }, [activeSimId]);

  function handleSelect(id: string) {
    if (id === 'custom') {
      setCustomModalOpen(true);
      return;
    }
    setActiveSimId(id);
  }

  function handleCustomCreated(simDef: SimDef) {
    setRuntimeSims(prev => [...prev, simDef]);
    setActiveSimId(simDef.id);
  }

  const sliderLabels = (activeSim.sliders || []).map(s => ({ key: s.key, label: s.label, unit: s.unit }));

  return (
    <div style={{ position: 'relative' }}>
      {/* Sim selector */}
      <div className="card mb-3">
        <div className="card-title mb-2">
          <Atom size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Physics 2 Simulation
        </div>
        <SimGrid active={activeSimId} onSelect={handleSelect} />
      </div>

      {/* Sim content */}
      {activeSim.type === 'phet' && activeSim.phetUrl ? (
        <div className="card mb-3" style={{ padding: 0, overflow: 'hidden' }}>
          <PhETEmbed url={activeSim.phetUrl} title={activeSim.title} />
        </div>
      ) : activeSim.sim ? (
        <div className="card mb-3">
          <SimSliders sliders={activeSim.sliders || []} params={params} onChange={setParams} />
          <div style={{ marginTop: (activeSim.sliders?.length ?? 0) > 0 ? 12 : 0 }}>
            <SimCanvas
              sim={activeSim.sim}
              params={params}
              running={running}
              onToggleRun={() => setRunning(r => !r)}
              onReset={() => setRunning(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Custom Sim Modal */}
      <CustomSimModal
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        onCreated={handleCustomCreated}
      />

      {/* Floating panels */}
      <NotesPanel
        open={notesOpen}
        onToggle={() => setNotesOpen(o => !o)}
        simName={activeSim.title}
        narrowed={helpOpen}
      />
      <SimHelpPanel
        open={helpOpen}
        onToggle={() => setHelpOpen(o => !o)}
        simTitle={activeSim.title}
        params={params}
        sliderLabels={sliderLabels}
        notesOpen={notesOpen}
      />
    </div>
  );
}

export default function PhysicsSimToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Physics Sim">
      <PhysicsSimTool />
    </ToolErrorBoundary>
  );
}
