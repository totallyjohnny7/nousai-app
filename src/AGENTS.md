# NousAI — src/ Directory

## Key Conventions

### State — always use the store correctly
```ts
const { data, updatePluginData } = useStore();  // useStore() everywhere
updatePluginData({ courses: [...] });            // partial updates only
// NEVER: setData(prev => ({ ...prev, pluginData: { ...prev.pluginData, ... } }))
```

### New pages → lazy load in App.tsx
```ts
const NewPage = lazy(() => import('./pages/NewPage'));
```

### New AI tools → wrap with error boundary
```tsx
<ToolErrorBoundary>
  <MyAITool />
</ToolErrorBoundary>
```

### Interfaces → src/types.ts
All shared types live in `types.ts`. Component-local types can stay co-located.

## Directory Map

| Dir/File | Contents |
|----------|---------|
| `store.tsx` | Zustand store, IDB sync, AutoSyncScheduler |
| `types.ts` | All shared TypeScript interfaces |
| `pages/` | Route-level page components (lazy loaded) |
| `components/` | Shared UI components |
| `components/aitools/` | AI tool panel implementations |
| `components/biolquiz/` | BIOL3020 Practium quiz system (BiolPractiumTab orchestrator + views + types) |
| `components/evolutionquiz/` | Evolution Practium quiz system (EvolutionPractiumTab orchestrator + views + types) |
| `hooks/` | Custom React hooks |
| `utils/` | Pure utility functions (ai, auth, fsrs, gamification, sync) |
| `assets/` | Static assets |
| `index.css` | Global CSS variables and base styles |
