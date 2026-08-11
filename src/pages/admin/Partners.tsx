import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { Partner } from '../../types'

const PARTNER_TYPES = ['Solution Partner', 'OEM', 'Referral', 'Reseller', 'ISV', 'PE Firm', 'Japan Partner']

interface NewPartnerForm {
  name: string
  enbl_stage: 'pre' | 'active' | 'post'
  category_types: string[]
  pdm: string
}

export function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [pdmFilter, setPdmFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPartnerForm>({ name: '', enbl_stage: 'pre', category_types: [], pdm: '' })

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
    const { data, error } = await supabase
      .from('partners')
      .insert([{
        name: form.name,
        enbl_stage: form.enbl_stage,
        category_type: form.category_types.join(', ') || null,
        pdm: form.pdm || null,
      }])
      .select()
      .single()
    if (!error && data) {
      setPartners(prev => [...prev, data as Partner].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAdd(false)
      setForm({ name: '', enbl_stage: 'pre', category_types: [], pdm: '' })
    }
    setSaving(false)
  }

  const pdmOptions = Array.from(new Set(partners.map(p => p.pdm).filter(Boolean))).sort() as string[]
  const regionOptions = Array.from(new Set(partners.map(p => p.region).filter(Boolean))).sort() as string[]

  const filtered = partners.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || p.enbl_stage === stageFilter
    const matchType = typeFilter === 'all' || (p.category_type ?? '').includes(typeFilter)
    const matchPdm = pdmFilter === 'all' || p.pdm === pdmFilter
    const matchRegion = regionFilter === 'all' || p.region === regionFilter
    return matchSearch && matchStage && matchType && matchPdm && matchRegion
  })

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-pendo-navy">Partners</h1>
            <p className="text-gray-500 mt-1">{partners.length} partners total</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-pendo-pink text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
          >
            + Add Partner
          </button>
        </div>

        {/* Add Partner Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-pendo-navy mb-4">Add Partner</h2>
              <form onSubmit={addPartner} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={form.enbl_stage}
                    onChange={e => setForm(f => ({ ...f, enbl_stage: e.target.value as 'pre' | 'active' | 'post' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                  >
                    <option value="pre">Pre</option>
                    <option value="active">Active</option>
                    <option value="post">Post</option>
                  </select>
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PDM</label>
                  <input
                    type="text"
                    value={form.pdm}
                    onChange={e => setForm(f => ({ ...f, pdm: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                    placeholder="Partner Development Manager name"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-pendo-pink text-white font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Add Partner'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
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
            placeholder="Search partners…"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none w-56"
          />
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
          >
            <option value="all">All Stages</option>
            <option value="pre">Pre</option>
            <option value="active">Active</option>
            <option value="post">Post</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
          >
            <option value="all">All Types</option>
            {PARTNER_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={pdmFilter}
            onChange={e => setPdmFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
          >
            <option value="all">All PDMs</option>
            {pdmOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {regionOptions.length > 0 && (
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
            >
              <option value="all">All Regions</option>
              {regionOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {(stageFilter !== 'all' || typeFilter !== 'all' || pdmFilter !== 'all' || regionFilter !== 'all' || search) && (
            <button
              onClick={() => { setSearch(''); setStageFilter('all'); setTypeFilter('all'); setPdmFilter('all'); setRegionFilter('all') }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Partner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PDM</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-pendo-navy">{p.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                        ${p.enbl_stage === 'active' ? 'bg-green-100 text-green-700' :
                          p.enbl_stage === 'pre' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {p.enbl_stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.category_type ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.pdm ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.region ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/partners/${p.id}`}
                        className="text-sm text-pendo-pink hover:text-pendo-pink-dark font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No partners match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
