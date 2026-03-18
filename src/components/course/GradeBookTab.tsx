/**
 * GradeBookTab — Grade Book UI for NousAI CoursePage
 * Sections: Categories, Grades, What-If
 */
import React, { useState, useMemo } from 'react';
import type { Course, CourseSpace, GradeCategory, GradeEntry, WhatIfEntry } from '../../types';
import { useStore } from '../../store';
import { getCourseSpace } from '../../utils/courseSpaceInit';
import { calculateFinalGrade, whatIfFinalGrade, gradeTrend } from '../../utils/gradeCalculator';

// ─── Props ─────────────────────────────────────────────────────────────────

interface GradeBookTabProps {
  course: Course;
  accentColor: string;
}

// ─── Local form state helpers ──────────────────────────────────────────────

interface AddGradeForm {
  name: string;
  score: string;
  total: string;
  date: string;
  flags: {
    curved: boolean;
    dropped: boolean;
    extra_credit: boolean;
  };
  note: string;
}

interface AddWhatIfForm {
  name: string;
  categoryId: string;
  hypotheticalScore: string;
  total: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultAddGradeForm(): AddGradeForm {
  return { name: '', score: '', total: '100', date: todayIso(), flags: { curved: false, dropped: false, extra_credit: false }, note: '' };
}

function defaultAddWhatIfForm(firstCatId = ''): AddWhatIfForm {
  return { name: '', categoryId: firstCatId, hypotheticalScore: '', total: '100' };
}

// ─── Flag chip styles ───────────────────────────────────────────────────────

function FlagChip({ flag }: { flag: 'curved' | 'dropped' | 'extra_credit' }) {
  const styles: Record<string, React.CSSProperties> = {
    curved:       { background: 'rgba(100,160,255,0.18)', color: '#7ab4ff', border: '1px solid rgba(100,160,255,0.35)' },
    dropped:      { background: 'rgba(255,100,100,0.15)', color: '#ff8080', border: '1px solid rgba(255,100,100,0.3)' },
    extra_credit: { background: 'rgba(80,220,130,0.15)', color: '#4dd090', border: '1px solid rgba(80,220,130,0.3)' },
  };
  const labels: Record<string, string> = { curved: 'Curved', dropped: 'Dropped', extra_credit: 'Extra Credit' };
  return (
    <span style={{
      ...styles[flag],
      fontSize: '10px',
      fontWeight: 600,
      padding: '1px 6px',
      borderRadius: '4px',
      marginRight: '4px',
      display: 'inline-block',
    }}>
      {labels[flag]}
    </span>
  );
}

// ─── Section switcher tabs ──────────────────────────────────────────────────

type Section = 'categories' | 'grades' | 'whatif';

interface SectionTabsProps {
  active: Section;
  onChange: (s: Section) => void;
  accentColor: string;
}

function SectionTabs({ active, onChange, accentColor }: SectionTabsProps) {
  const tabs: { id: Section; label: string }[] = [
    { id: 'categories', label: 'Categories' },
    { id: 'grades', label: 'Grades' },
    { id: 'whatif', label: 'What-If' },
  ];
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: active === t.id ? `2px solid ${accentColor}` : '2px solid transparent',
            color: active === t.id ? accentColor : 'var(--text-secondary)',
            fontWeight: active === t.id ? 600 : 400,
            fontSize: '14px',
            padding: '8px 14px',
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
            marginBottom: '-1px',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GradeBookTab({ course, accentColor }: GradeBookTabProps) {
  const { data, setData } = useStore();
  const space = getCourseSpace(data?.pluginData?.courseSpaces, course.id);

  const [activeSection, setActiveSection] = useState<Section>('grades');

  // ── Derived grade state ──────────────────────────────────────────────────
  const finalGrade = useMemo(
    () => calculateFinalGrade(space.gradeCategories, space.gradeEntries),
    [space.gradeCategories, space.gradeEntries]
  );

  const whatIfGrade = useMemo(
    () => whatIfFinalGrade(space.gradeCategories, space.gradeEntries, space.whatIfEntries),
    [space.gradeCategories, space.gradeEntries, space.whatIfEntries]
  );

  const trend = useMemo(() => gradeTrend(space.gradeEntries), [space.gradeEntries]);

  // ── Save helper — uses functional updater to avoid stale closure ──────────
  function save(patch: Partial<CourseSpace>) {
    setData(prev => {
      if (!prev) return prev;
      const prevSpace = getCourseSpace(prev.pluginData?.courseSpaces, course.id);
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          courseSpaces: {
            ...(prev.pluginData?.courseSpaces ?? {}),
            [course.id]: { ...prevSpace, ...patch, updatedAt: new Date().toISOString() },
          },
        },
      };
    });
  }

  return (
    <div style={{ padding: '0' }}>
      <SectionTabs active={activeSection} onChange={setActiveSection} accentColor={accentColor} />

      {activeSection === 'categories' && (
        <CategoriesSection space={space} save={save} accentColor={accentColor} />
      )}
      {activeSection === 'grades' && (
        <GradesSection
          space={space}
          save={save}
          accentColor={accentColor}
          finalGrade={finalGrade}
          trend={trend}
          onSwitchToCategories={() => setActiveSection('categories')}
        />
      )}
      {activeSection === 'whatif' && (
        <WhatIfSection
          space={space}
          save={save}
          accentColor={accentColor}
          finalGrade={finalGrade}
          whatIfGrade={whatIfGrade}
        />
      )}
    </div>
  );
}

// ─── Categories Section ─────────────────────────────────────────────────────

interface CategoriesSectionProps {
  space: ReturnType<typeof getCourseSpace>;
  save: (patch: Partial<ReturnType<typeof getCourseSpace>>) => void;
  accentColor: string;
}

function CategoriesSection({ space, save, accentColor }: CategoriesSectionProps) {
  const [editingCategories, setEditingCategories] = useState<GradeCategory[]>(
    () => space.gradeCategories.map(c => ({ ...c }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [addCatName, setAddCatName] = useState('');
  const [addCatWeight, setAddCatWeight] = useState('');

  const weightSum = editingCategories.reduce((a, c) => a + c.weight, 0);
  const weightValid = Math.abs(weightSum - 100) <= 0.01;

  function updateCategory(id: string, field: 'name' | 'weight', value: string) {
    setEditingCategories(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, [field]: field === 'weight' ? (parseFloat(value) || 0) : value }
          : c
      )
    );
    setIsDirty(true);
  }

  function deleteCategory(cat: GradeCategory) {
    const entryCount = space.gradeEntries.filter(e => e.categoryId === cat.id).length;
    const msg = entryCount > 0
      ? `Delete '${cat.name}'? This will also remove ${entryCount} grade ${entryCount === 1 ? 'entry' : 'entries'}. This can't be undone.`
      : `Delete '${cat.name}'? This can't be undone.`;
    if (!window.confirm(msg)) return;

    const newCategories = editingCategories.filter(c => c.id !== cat.id);
    const newEntries = space.gradeEntries.filter(e => e.categoryId !== cat.id);
    setEditingCategories(newCategories);
    // Immediately save both categories and entries
    save({ gradeCategories: newCategories, gradeEntries: newEntries });
    setIsDirty(false);
  }

  function saveCategories() {
    if (!weightValid || !isDirty) return;
    save({ gradeCategories: editingCategories });
    setIsDirty(false);
  }

  function addCategory() {
    const trimName = addCatName.trim();
    const w = parseFloat(addCatWeight);
    if (!trimName || isNaN(w) || w <= 0) return;
    const newCat: GradeCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimName,
      weight: w,
    };
    const updated = [...editingCategories, newCat];
    setEditingCategories(updated);
    setAddCatName('');
    setAddCatWeight('');
    setIsDirty(true);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Grade Categories
        </h3>
        <button
          className="btn btn-sm"
          onClick={saveCategories}
          disabled={!weightValid || !isDirty}
          style={{
            background: weightValid && isDirty ? accentColor : 'var(--bg-input)',
            color: weightValid && isDirty ? '#000' : 'var(--text-dim)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: weightValid && isDirty ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          Save Categories
        </button>
      </div>

      {/* Warning banner */}
      {!weightValid && (
        <div style={{
          background: 'rgba(255, 200, 60, 0.12)',
          border: '1px solid rgba(255, 200, 60, 0.35)',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '13px',
          color: '#ffc83c',
        }}>
          Weights sum to {weightSum.toFixed(1)}% — must equal 100%
        </div>
      )}

      {/* Empty state */}
      {editingCategories.length === 0 ? (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: '14px',
          marginBottom: '12px',
        }}>
          No categories yet. Add your first category (e.g., Exams 40%, Homework 30%)
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 44px',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <span>Name</span>
            <span>Weight (%)</span>
            <span></span>
          </div>

          {/* Category rows */}
          {editingCategories.map(cat => (
            <div key={cat.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 44px',
              gap: '8px',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
            }}>
              <input
                type="text"
                value={cat.name}
                onChange={e => updateCategory(cat.id, 'name', e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '5px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="number"
                value={cat.weight}
                min={0}
                max={100}
                step={0.1}
                onChange={e => updateCategory(cat.id, 'weight', e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '5px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <button
                aria-label={`Delete category ${cat.name}`}
                onClick={() => deleteCategory(cat)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add category row */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Category name"
          value={addCatName}
          onChange={e => setAddCatName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        />
        <input
          type="number"
          placeholder="Weight %"
          value={addCatWeight}
          min={0}
          max={100}
          step={0.1}
          onChange={e => setAddCatWeight(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
          style={{
            width: '100px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        />
        <button
          className="btn btn-sm"
          onClick={addCategory}
          disabled={!addCatName.trim() || !addCatWeight}
          style={{
            background: accentColor,
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: addCatName.trim() && addCatWeight ? 'pointer' : 'not-allowed',
            opacity: addCatName.trim() && addCatWeight ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Grades Section ─────────────────────────────────────────────────────────

interface GradesSectionProps {
  space: ReturnType<typeof getCourseSpace>;
  save: (patch: Partial<ReturnType<typeof getCourseSpace>>) => void;
  accentColor: string;
  finalGrade: { letter: string; percent: number; breakdown: Record<string, number> };
  trend: 'up' | 'down' | 'neutral';
  onSwitchToCategories: () => void;
}

function GradesSection({ space, save, accentColor, finalGrade, trend, onSwitchToCategories }: GradesSectionProps) {
  const [showAddForCat, setShowAddForCat] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddGradeForm>(defaultAddGradeForm);

  const hasMultipleDrops = useMemo(() => {
    return space.gradeCategories.some(cat => {
      const dropped = space.gradeEntries.filter(e => e.categoryId === cat.id && e.flags.includes('dropped'));
      return dropped.length > 1;
    });
  }, [space.gradeCategories, space.gradeEntries]);

  const totalGradedEntries = space.gradeEntries.filter(e => e.score !== null).length;

  function openAddForm(catId: string) {
    setShowAddForCat(catId);
    setAddForm(defaultAddGradeForm());
  }

  function cancelAdd() {
    setShowAddForCat(null);
    setAddForm(defaultAddGradeForm());
  }

  function saveGradeEntry(catId: string) {
    const trimName = addForm.name.trim();
    if (!trimName) return;

    const total = parseFloat(addForm.total);
    if (isNaN(total) || total <= 0) return;

    const rawScore = addForm.score.trim() === '' ? null : parseFloat(addForm.score);
    const flags: GradeEntry['flags'] = [];
    if (addForm.flags.curved) flags.push('curved');
    if (addForm.flags.dropped) flags.push('dropped');
    if (addForm.flags.extra_credit) flags.push('extra_credit');

    // Validate score <= total unless extra_credit
    if (rawScore !== null && !addForm.flags.extra_credit && rawScore > total) return;

    const entry: GradeEntry = {
      id: `ge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      categoryId: catId,
      name: trimName,
      score: rawScore,
      total,
      date: addForm.date || todayIso(),
      flags,
      note: addForm.note.trim() || undefined,
    };

    save({ gradeEntries: [...space.gradeEntries, entry] });
    setShowAddForCat(null);
    setAddForm(defaultAddGradeForm());
  }

  function deleteEntry(entryId: string) {
    save({ gradeEntries: space.gradeEntries.filter(e => e.id !== entryId) });
  }

  function exportCsv() {
    const header = 'Category,Name,Score,Total,Percent,Flags,Date\n';
    const rows = space.gradeEntries
      .map(entry => {
        const cat = space.gradeCategories.find(c => c.id === entry.categoryId);
        const catName = cat?.name ?? '';
        const pct = entry.score !== null && entry.total > 0
          ? Math.round((entry.score / entry.total) * 100) + '%'
          : '';
        const flagStr = entry.flags.join('|');
        const dateStr = entry.date.slice(0, 10);
        return [catName, entry.name, entry.score ?? '', entry.total, pct, flagStr, dateStr]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      })
      .join('\n');
    const csv = header + rows;
    const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grades-${Date.now()}.csv`;
    a.click();
  }

  if (space.gradeCategories.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '12px' }}>
          Set up grade categories first → go to Categories tab
        </div>
        <button
          className="btn btn-sm"
          onClick={onSwitchToCategories}
          style={{
            background: accentColor,
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Go to Categories
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Overall grade + export */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current Grade:</span>
          <span style={{
            fontSize: '22px',
            fontWeight: 700,
            color: finalGrade.letter === '—' ? 'var(--text-dim)' : accentColor,
            fontFamily: 'DM Mono, monospace',
          }}>
            {finalGrade.letter}
          </span>
          {finalGrade.letter !== '—' && (
            <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
              ({finalGrade.percent}%)
            </span>
          )}
          {totalGradedEntries >= 3 && (
            <span
              aria-label={`Grade trend: ${trend}`}
              style={{
                fontSize: '18px',
                color: trend === 'up' ? '#4dd090' : trend === 'down' ? '#ff6b6b' : 'var(--text-dim)',
                fontWeight: 700,
                marginLeft: '4px',
              }}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
            </span>
          )}
        </div>
        <button
          className="btn btn-sm"
          onClick={exportCsv}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '5px 12px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Multiple drops warning */}
      {hasMultipleDrops && (
        <div style={{
          background: 'rgba(255, 200, 60, 0.10)',
          border: '1px solid rgba(255, 200, 60, 0.3)',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '13px',
          color: '#ffc83c',
        }}>
          Multiple drops detected — verify this matches your syllabus.
        </div>
      )}

      {/* Categories */}
      {[...space.gradeCategories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => {
        const catEntries = [...space.gradeEntries.filter(e => e.categoryId === cat.id)]
          .sort((a, b) => b.date.localeCompare(a.date));
        const isAdding = showAddForCat === cat.id;
        const catAvg = finalGrade.breakdown[cat.name];

        return (
          <div key={cat.id} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            marginBottom: '12px',
            overflow: 'hidden',
          }}>
            {/* Category header */}
            <div style={{
              padding: '10px 14px',
              borderBottom: catEntries.length > 0 || isAdding ? '1px solid var(--border)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{cat.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{cat.weight}%</span>
                {catAvg !== undefined && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: accentColor,
                    fontFamily: 'DM Mono, monospace',
                  }}>
                    avg: {catAvg}%
                  </span>
                )}
              </div>
              <button
                className="btn btn-sm"
                onClick={() => isAdding ? cancelAdd() : openAddForm(cat.id)}
                aria-label={isAdding ? `Cancel adding grade to ${cat.name}` : `Add grade to ${cat.name}`}
                style={{
                  background: isAdding ? 'var(--bg-input)' : accentColor,
                  color: isAdding ? 'var(--text-secondary)' : '#000',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isAdding ? 'Cancel' : '+ Add Grade'}
              </button>
            </div>

            {/* Add grade inline form */}
            {isAdding && (
              <AddGradeForm
                form={addForm}
                onChange={setAddForm}
                onSave={() => saveGradeEntry(cat.id)}
                onCancel={cancelAdd}
                accentColor={accentColor}
              />
            )}

            {/* Grade entries */}
            {catEntries.length === 0 && !isAdding ? (
              <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-dim)' }}>
                No grades in {cat.name} yet
              </div>
            ) : (
              catEntries.map(entry => (
                <GradeEntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => deleteEntry(entry.id)}
                  accentColor={accentColor}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Grade Form ─────────────────────────────────────────────────────────

interface AddGradeFormProps {
  form: AddGradeForm;
  onChange: (f: AddGradeForm) => void;
  onSave: () => void;
  onCancel: () => void;
  accentColor: string;
}

function AddGradeForm({ form, onChange, onSave, onCancel, accentColor }: AddGradeFormProps) {
  const total = parseFloat(form.total) || 0;
  const isExtraCredit = form.flags.extra_credit;

  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 140px', gap: '8px', marginBottom: '8px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Name *</label>
          <input
            type="text"
            placeholder="e.g. Midterm 1"
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Score</label>
          <input
            type="number"
            placeholder="—"
            value={form.score}
            min={0}
            {...(!isExtraCredit && total > 0 ? { max: total } : {})}
            onChange={e => onChange({ ...form, score: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Total</label>
          <input
            type="number"
            placeholder="100"
            value={form.total}
            min={0.1}
            step={0.1}
            onChange={e => onChange({ ...form, total: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => onChange({ ...form, date: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Flags */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {(['curved', 'dropped', 'extra_credit'] as const).map(flag => (
          <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.flags[flag]}
              onChange={e => onChange({ ...form, flags: { ...form.flags, [flag]: e.target.checked } })}
            />
            {flag === 'extra_credit' ? 'Extra Credit' : flag.charAt(0).toUpperCase() + flag.slice(1)}
          </label>
        ))}
      </div>

      {/* Note */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Note (optional)</label>
        <textarea
          placeholder="Add a note..."
          value={form.note}
          onChange={e => onChange({ ...form, note: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-sm"
          onClick={onSave}
          disabled={!form.name.trim()}
          style={{
            background: form.name.trim() ? accentColor : 'var(--bg-input)',
            color: form.name.trim() ? '#000' : 'var(--text-dim)',
            border: 'none',
            borderRadius: '5px',
            padding: '5px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: form.name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save
        </button>
        <button
          className="btn btn-sm"
          onClick={onCancel}
          style={{
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            padding: '5px 14px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Grade Entry Row ─────────────────────────────────────────────────────────

interface GradeEntryRowProps {
  entry: GradeEntry;
  onDelete: () => void;
  accentColor: string;
}

function GradeEntryRow({ entry, onDelete, accentColor }: GradeEntryRowProps) {
  const isDropped = entry.flags.includes('dropped');
  const pct = entry.score !== null && entry.total > 0
    ? Math.round((entry.score / entry.total) * 100)
    : null;

  return (
    <div style={{
      padding: '9px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: isDropped ? 'rgba(255,100,100,0.04)' : 'transparent',
      opacity: isDropped ? 0.65 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          textDecoration: isDropped ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {entry.name}
        </div>
        {entry.note && (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            {entry.note}
          </div>
        )}
      </div>

      {/* Score */}
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: '13px',
        color: isDropped ? 'var(--text-dim)' : 'var(--text-primary)',
        textDecoration: isDropped ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
      }}>
        {entry.score !== null ? `${entry.score}/${entry.total}` : `—/${entry.total}`}
      </div>

      {/* Percent */}
      {pct !== null && !isDropped && (
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '13px',
          fontWeight: 600,
          color: pct >= 90 ? '#4dd090' : pct >= 70 ? accentColor : '#ff6b6b',
          minWidth: '40px',
          textAlign: 'right',
        }}>
          {pct}%
        </div>
      )}

      {/* Date */}
      <div style={{ fontSize: '12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        {entry.date.slice(0, 10)}
      </div>

      {/* Flags */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0' }}>
        {entry.flags.map(f => <FlagChip key={f} flag={f} />)}
      </div>

      {/* Delete */}
      <button
        aria-label={`Delete grade entry ${entry.name}`}
        onClick={onDelete}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: '4px',
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; }}
      >
        ×
      </button>
    </div>
  );
}

// ─── What-If Section ─────────────────────────────────────────────────────────

interface WhatIfSectionProps {
  space: ReturnType<typeof getCourseSpace>;
  save: (patch: Partial<ReturnType<typeof getCourseSpace>>) => void;
  accentColor: string;
  finalGrade: { letter: string; percent: number; breakdown: Record<string, number> };
  whatIfGrade: { letter: string; percent: number };
}

function WhatIfSection({ space, save, accentColor, finalGrade, whatIfGrade }: WhatIfSectionProps) {
  const firstCatId = space.gradeCategories[0]?.id ?? '';
  const [addForm, setAddForm] = useState<AddWhatIfForm>(() => defaultAddWhatIfForm(firstCatId));
  const [isAdding, setIsAdding] = useState(false);

  function openAdd() {
    setAddForm(defaultAddWhatIfForm(space.gradeCategories[0]?.id ?? ''));
    setIsAdding(true);
  }

  function cancelAdd() {
    setIsAdding(false);
  }

  function saveWhatIf() {
    const trimName = addForm.name.trim();
    if (!trimName || !addForm.categoryId) return;

    const total = parseFloat(addForm.total);
    if (isNaN(total) || total <= 0) return;

    const score = parseFloat(addForm.hypotheticalScore);
    if (isNaN(score) || score < 0) return;

    // Validate score <= total
    if (score > total) return;

    const entry: WhatIfEntry = {
      id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimName,
      categoryId: addForm.categoryId,
      hypotheticalScore: score,
      total,
    };

    save({ whatIfEntries: [...space.whatIfEntries, entry] });
    setIsAdding(false);
  }

  function deleteWhatIf(id: string) {
    save({ whatIfEntries: space.whatIfEntries.filter(e => e.id !== id) });
  }

  return (
    <div>
      {/* Grade comparison header */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Current grade */}
        <div style={{
          flex: 1,
          minWidth: '140px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current Grade
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>
              {finalGrade.letter}
            </span>
            {finalGrade.letter !== '—' && (
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                {finalGrade.percent}%
              </span>
            )}
          </div>
        </div>

        {/* What-if grade */}
        <div style={{
          flex: 1,
          minWidth: '140px',
          background: `rgba(245, 166, 35, 0.06)`,
          border: `2px dashed ${accentColor}`,
          borderRadius: '8px',
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: '11px', color: accentColor, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
            Projected
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: accentColor, fontFamily: 'DM Mono, monospace' }}>
              {whatIfGrade.letter}
            </span>
            {whatIfGrade.letter !== '—' && (
              <span style={{ fontSize: '14px', color: accentColor, fontFamily: 'DM Mono, monospace', opacity: 0.8 }}>
                {whatIfGrade.percent}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add button */}
      {space.gradeCategories.length === 0 ? (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-dim)',
        }}>
          Set up grade categories first before adding what-if entries.
        </div>
      ) : (
        <>
          {/* What-if entries */}
          {space.whatIfEntries.length === 0 && !isAdding ? (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--text-dim)',
              marginBottom: '12px',
            }}>
              Add hypothetical grades to see how they'd affect your overall grade
            </div>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              {space.whatIfEntries.map(entry => {
                const cat = space.gradeCategories.find(c => c.id === entry.categoryId);
                const pct = entry.total > 0 ? Math.round((entry.hypotheticalScore / entry.total) * 100) : 0;
                return (
                  <div key={entry.id} style={{
                    background: `rgba(245, 166, 35, 0.06)`,
                    border: `1px solid rgba(245, 166, 35, 0.25)`,
                    borderLeft: `2px dashed ${accentColor}`,
                    borderRadius: '6px',
                    padding: '9px 14px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{entry.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '8px' }}>{cat?.name ?? 'Unknown'}</span>
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {entry.hypotheticalScore}/{entry.total}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, color: accentColor }}>
                      {pct}%
                    </div>
                    <button
                      aria-label={`Delete what-if entry ${entry.name}`}
                      onClick={() => deleteWhatIf(entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '2px 4px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add what-if form */}
          {isAdding ? (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Final Exam"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Category</label>
                  <select
                    value={addForm.categoryId}
                    onChange={e => setAddForm({ ...addForm, categoryId: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {space.gradeCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Score</label>
                  <input
                    type="number"
                    placeholder="—"
                    value={addForm.hypotheticalScore}
                    min={0}
                    max={parseFloat(addForm.total) || undefined}
                    onChange={e => setAddForm({ ...addForm, hypotheticalScore: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Total</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={addForm.total}
                    min={0.1}
                    step={0.1}
                    onChange={e => setAddForm({ ...addForm, total: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-sm"
                  onClick={saveWhatIf}
                  disabled={!addForm.name.trim() || !addForm.categoryId}
                  style={{
                    background: addForm.name.trim() && addForm.categoryId ? accentColor : 'var(--bg-input)',
                    color: addForm.name.trim() && addForm.categoryId ? '#000' : 'var(--text-dim)',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: addForm.name.trim() && addForm.categoryId ? 'pointer' : 'not-allowed',
                  }}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm"
                  onClick={cancelAdd}
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-sm"
              onClick={openAdd}
              style={{
                background: accentColor,
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + Add What-If Grade
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Shared input style ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '5px 8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
};
