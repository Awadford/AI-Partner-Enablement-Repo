import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { Partner } from '../../types'

export const PARTNER_TYPES = ['Solution Partner', 'OEM', 'Referral', 'Reseller', 'Services', 'Subcontractor', 'HyperScaler', 'ISV', 'PE Firm', 'Japan Partner']
const INTERNAL_TYPE = 'Internal Pendo'

interface NewPartnerForm {
  name: string
  enbl_stage: 'pre' | 'active' | 'post'
  category_types: string[]
  pdm: string
  is_internal: boolean
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium
      ${stage === 'active' ? 'bg-green-100 text-green-700' :
        stage === 'pre' ? 'bg-yellow-100 text-yellow-700' :
        'bg-gray-100 text-gray-600'}`}>
      {stage === 'pre' ? 'Pre Agreement' : stage === 'post' ? 'Inactive' : 'Active'}
    </span>
  )
}

function PartnerTable({ rows }: { rows: Partner[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-400">
        No entries yet.
      </div>
    )
  }
  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PDM</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Region</th>
          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(p => (
          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-6 py-4 font-medium text-pendo-navy">{p.name}</td>
            <td className="px-6 py-4"><StageBadge stage={p.enbl_stage} /></td>
            <td className="px-6 py-4 text-sm text-gray-600">
              {(p.category_type ?? '').replace(`, ${INTERNAL_TYPE}`, '').replace(`${INTERNAL_TYPE}, `, '').replace(INTERNAL_TYPE, '') || '—'}
            </td>
            <td className="px-6 py-4 text-sm text-gray-600">{p.pdm ?? '—'}</td>
            <td className="px-6 py-4 text-sm text-gray-600">{p.region ?? '—'}</td>
            <td className="px-6 py-4 text-right">
              <Link to={`/admin/partners/${p.id}`} className="text-sm text-pendo-pink hover:text-pendo-pink-dark font-medium">
                Manage →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Section({ title, count, children, defaultOpen = true }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-pendo-navy text-lg">{title}</span>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}

export function AdminPartners() {
  const [searchParams] = useSearchParams()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get('stage') ?? 'all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [pdmFilter, setPdmFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPartnerForm>({ name: '', enbl_stage: 'pre', category_types: [], pdm: '', is_internal: false })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('partners').select('*').order('name')
      setPartners((data ?? []) as Partner[])
      setLoading(false)
    }
    load()
  }, [])

  async function addPartner(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const types = form.is_internal
      ? [...form.category_types, INTERNAL_TYPE]
      : form.category_types
    const { data, error } = await supabase
      .from('partners')
      .insert([{
        name: form.name,
        enbl_stage: form.enbl_stage,
        category_type: types.join(', ') || null,
        pdm: form.pdm || null,
      }])
      .select()
      .single()
    if (!error && data) {
      setPartners(prev => [...prev, data as Partner].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAdd(false)
      setForm({ name: '', enbl_stage: 'pre', category_types: [], pdm: '', is_internal: false })
    }
    setSaving(false)
  }

  const pdmOptions = Array.from(new Set(partners.map(p => p.pdm).filter(Boolean))).sort() as string[]
  const regionOptions = Array.from(new Set(partners.map(p => p.region).filter(Boolean))).sort() as string[]

  const isInternal = (p: Partner) => (p.category_type ?? '').includes(INTERNAL_TYPE)

  const applyFilters = (list: Partner[]) => list.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || p.enbl_stage === stageFilter
    const matchType = typeFilter === 'all' || (p.category_type ?? '').includes(typeFilter)
    const matchPdm = pdmFilter === 'all' || p.pdm === pdmFilter
    const matchRegion = regionFilter === 'all' || p.region === regionFilter
    return matchSearch && matchStage && matchType && matchPdm && matchRegion
  })

  const externalPartners = applyFilters(partners.filter(p => !isInternal(p)))
  const internalOrgs = applyFilters(partners.filter(p => isInternal(p)))
  const hasFilters = stageFilter !== 'all' || typeFilter !== 'all' || pdmFilter !== 'all' || regionFilter !== 'all' || search

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-pendo-navy">Partners & Internal Teams</h1>
            <p className="text-gray-500 mt-1">{partners.length} total</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-pendo-pink text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Add Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-pendo-navy mb-4">Add Entry</h2>
              <form onSubmit={addPartner} className="space-y-4">
                {/* Internal toggle */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_internal: !f.is_internal }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                      ${form.is_internal ? 'bg-pendo-pink' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                      ${form.is_internal ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {form.is_internal ? 'Internal Pendo Org / Team' : 'External Partner'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                    placeholder={form.is_internal ? 'e.g. Sales Engineering' : 'Acme Corp'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={form.enbl_stage}
                    onChange={e => setForm(f => ({ ...f, enbl_stage: e.target.value as 'pre' | 'active' | 'post' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                  >
                    <option value="pre">Pre Agreement</option>
                    <option value="active">Active</option>
                    <option value="post">Inactive</option>
                  </select>
                </div>
                {!form.is_internal && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Partner Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PARTNER_TYPES.map(type => (
                        <label key={type} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.category_types.includes(type)}
                            onChange={e => setForm(f => ({
                              ...f,
                              category_types: e.target.checked
                                ? [...f.category_types, type]
                                : f.category_types.filter(t => t !== type)
                            }))}
                            className="rounded border-gray-300 text-pendo-pink focus:ring-pendo-pink"
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PDM</label>
                  <input
                    type="text"
                    value={form.pdm}
                    onChange={e => setForm(f => ({ ...f, pdm: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                    placeholder="Partner Development Manager"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 bg-pendo-pink text-white font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none w-48"
          />
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none">
            <option value="all">All Stages</option>
            <option value="pre">Pre Agreement</option>
            <option value="active">Active</option>
            <option value="post">Inactive</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none">
            <option value="all">All Types</option>
            {PARTNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={pdmFilter} onChange={e => setPdmFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none">
            <option value="all">All PDMs</option>
            {pdmOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {regionOptions.length > 0 && (
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none">
              <option value="all">All Regions</option>
              {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStageFilter('all'); setTypeFilter('all'); setPdmFilter('all'); setRegionFilter('all') }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink" />
          </div>
        ) : (
          <>
            <Section title="Partners" count={externalPartners.length} defaultOpen={true}>
              <PartnerTable rows={externalPartners} />
            </Section>
            <Section title="Internal Pendo Orgs" count={internalOrgs.length} defaultOpen={true}>
              <PartnerTable rows={internalOrgs} />
            </Section>
          </>
        )}
      </div>
    </Layout>
  )
}
