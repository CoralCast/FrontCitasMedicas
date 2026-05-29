import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  cancelCita,
  clearSession,
  completeCita,
  getCitas,
  getDisponibilidad,
  getStoredUser,
  rescheduleCita,
} from "../services/api"

const today = new Date().toISOString().slice(0, 10)

function formatDay(fecha) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  })
}

function formatLongDate(fecha) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function timeText(value) {
  return String(value || "").slice(0, 5)
}

function citaDateTime(cita) {
  return new Date(`${cita.fecha}T${timeText(cita.hora_inicio) || "00:00"}`).getTime()
}

function sortClosestCitas(citas) {
  const now = Date.now()

  return [...citas].sort((a, b) => {
    const aTime = citaDateTime(a)
    const bTime = citaDateTime(b)
    const aUpcoming = aTime >= now
    const bUpcoming = bTime >= now

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    return aUpcoming ? aTime - bTime : bTime - aTime
  })
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, mins + minutes, 0, 0)
  return date.toTimeString().slice(0, 5)
}

function statusLabel(estado) {
  if (estado === "completada") return "Finalizada"
  if (estado === "cancelada") return "Cancelada"
  return "Pendiente"
}

function statusClass(estado) {
  if (estado === "completada") return "bg-emerald-50 text-emerald-700"
  if (estado === "cancelada") return "bg-red-50 text-red-600"
  return "bg-blue-50 text-blue-700"
}

export default function CitasDoctor() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [citas, setCitas] = useState([])
  const [query, setQuery] = useState("")
  const [viewMode, setViewMode] = useState("hoy")
  const [statusFilter, setStatusFilter] = useState("todas")
  const [selectedCita, setSelectedCita] = useState(null)
  const [modalCita, setModalCita] = useState(null)
  const [nuevaFecha, setNuevaFecha] = useState(today)
  const [nuevaHora, setNuevaHora] = useState("")
  const [duracion, setDuracion] = useState("30")
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const sortedCitas = useMemo(
    () => sortClosestCitas(citas),
    [citas],
  )

  const pendingCitas = sortedCitas.filter((cita) => cita.estado === "pendiente")
  const todayCitas = sortedCitas.filter((cita) => cita.fecha === today)
  const nextCita = pendingCitas.find((cita) => `${cita.fecha}T${timeText(cita.hora_inicio)}` >= `${today}T00:00`)

  const visibleCitas = useMemo(() => {
    const search = query.trim().toLowerCase()
    const byDate =
      viewMode === "hoy"
        ? (todayCitas.length > 0 ? todayCitas : nextCita ? [nextCita] : [])
        : sortedCitas

    const byStatus =
      statusFilter === "todas"
        ? byDate
        : byDate.filter((cita) => cita.estado === statusFilter)

    if (!search) return byStatus

    return byStatus.filter((cita) =>
      [
        cita.paciente?.nombre_completo,
        cita.doctor?.especialidad,
        cita.motivo,
        cita.estado,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search)),
    )
  }, [nextCita, query, sortedCitas, statusFilter, todayCitas, viewMode])

  const doctorProfile = user?.doctor || sortedCitas.find((cita) => cita.doctor)?.doctor
  const doctorName = doctorProfile?.nombre_completo || "Doctor"
  const doctorSpecialty = doctorProfile?.especialidad || "Medico"

  async function loadCitas() {
    setLoading(true)
    setError("")

    try {
      // Contrato backend para rol doctor: GET /citas/me regresa solo sus citas.
      setCitas(await getCitas())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadCitas()
    })
  }, [])

  useEffect(() => {
    async function loadAvailability() {
      if (!modalCita || !nuevaFecha) {
        setHorarios([])
        setNuevaHora("")
        return
      }

      setLoadingHorarios(true)
      setError("")

      try {
        // Para reagendar se consulta disponibilidad del mismo doctor y nueva fecha.
        const data = await getDisponibilidad(modalCita.doctor.id_doctor, nuevaFecha)
        setHorarios(data.horarios_disponibles || [])
        setNuevaHora("")
      } catch (err) {
        setHorarios([])
        setError(err.message)
      } finally {
        setLoadingHorarios(false)
      }
    }

    loadAvailability()
  }, [modalCita, nuevaFecha])

  function logout() {
    clearSession()
    navigate("/", { replace: true })
  }

  function openReschedule(cita) {
    setSelectedCita(null)
    setModalCita(cita)
    setNuevaFecha(cita.fecha >= today ? cita.fecha : today)
    setNuevaHora("")
    setDuracion("30")
    setHorarios([])
    setNotice("")
    setError("")
  }

  function openDetail(cita) {
    setSelectedCita(cita)
    setNotice("")
    setError("")
  }

  async function handleCancel(cita) {
    setError("")
    setNotice("")

    try {
      // Contrato backend: PATCH /citas/{id}/cancelar no manda body.
      await cancelCita(cita.id_cita)
      setNotice("Cita cancelada correctamente.")
      setSelectedCita(null)
      await loadCitas()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleComplete(cita) {
    setError("")
    setNotice("")
    setSaving(true)

    try {
      await completeCita(cita.id_cita)
      setNotice("Cita marcada como completada correctamente.")
      setSelectedCita(null)
      await loadCitas()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReschedule(event) {
    event.preventDefault()
    setError("")
    setNotice("")

    if (!modalCita || !nuevaFecha || !nuevaHora) {
      setError("Selecciona una nueva fecha y un horario disponible para reagendar.")
      return
    }

    setSaving(true)

    try {
      // Contrato backend para doctor: PATCH /citas/{id}/reprogramar.
      // El doctor puede mandar hora_fin para ajustar duracion si lo necesita.
      await rescheduleCita(modalCita.id_cita, {
        fecha: nuevaFecha,
        hora_inicio: nuevaHora,
        hora_fin: addMinutes(nuevaHora, Number(duracion)),
      })
      setNotice("Cita reagendada correctamente.")
      setModalCita(null)
      await loadCitas()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`doctor-page h-screen overflow-hidden bg-gray-100 text-slate-900 ${sidebarOpen ? "sidebar-open" : ""}`}>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label="Abrir menu"
      >
        <span />
        <span />
        <span />
      </button>
      <button
        type="button"
        className="mobile-menu-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-label="Cerrar menu"
      />
      <div className="flex h-screen bg-white shadow-sm">
        <aside className="app-sidebar doctor-sidebar flex h-screen w-72 flex-col justify-between border-r border-slate-100 bg-white px-6 py-4">
          <div>
            

            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700">
                Dr
              </div>
              <div>
                <p className="text-sm font-semibold">{doctorName}</p>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  {doctorSpecialty}
                </p>
              </div>
            </div>

            <nav className="space-y-3">
              <button className="doctor-nav-item flex w-full items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs text-white">
                  1
                </span>
                Agenda Medica
              </button>
            
            </nav>
          </div>

          <button
            type="button"
            onClick={logout}
            className="doctor-logout rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-800"
          >
            Cerrar sesion
          </button>
        </aside>

        <main className="doctor-main h-screen flex-1 overflow-y-auto bg-gray-50">
          <header className="doctor-header relative border-b border-slate-100 bg-white px-8 py-5">
            <div className="text-center">
              <h2 className="text-2xl font-semibold">Mi agenda del dia</h2>
              <p className="mt-1 text-sm font-semibold uppercase text-blue-700">
                {formatDay(today)}
              </p>
            </div>

            <div className="doctor-header-actions absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-4">
              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar paciente..."
                  className="w-64 rounded-full border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="rounded-full border border-slate-100 bg-slate-50 px-5 py-2 text-sm text-slate-500">
                <p className="font-semibold text-slate-700">{doctorName}</p>
                <p className="text-xs">{user?.correo || "Sin correo"}</p>
              </div>
            </div>
          </header>

          <section className="px-8 py-8">
            {error && (
              <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {notice}
              </p>
            )}

            <div className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-4">
              <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
                <p className="mb-2 text-sm font-semibold text-slate-500">Proxima Consulta</p>
                {nextCita ? (
                  <div className="flex items-end justify-between gap-5">
                    <div className="min-w-0">
                      <p className="text-4xl font-semibold text-blue-700">
                        {timeText(nextCita.hora_inicio)}
                      </p>
                      <p className="mt-1 truncate font-semibold">{nextCita.paciente?.nombre_completo}</p>
                      <p className="text-sm text-slate-400 capitalize">{formatLongDate(nextCita.fecha)}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold uppercase text-blue-700">
                      Confirmada
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No hay consultas pendientes.</p>
                )}
              </article>

              <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <p className="mb-8 text-sm font-semibold text-slate-500">Total Citas</p>
                <p className="text-4xl font-semibold">{sortedCitas.length}</p>
              </article>

              <article className="rounded-2xl border border-slate-100 bg-blue-50 p-6 shadow-sm">
                <p className="mb-8 text-sm font-semibold text-slate-500">Pendientes</p>
                <p className="text-4xl font-semibold text-blue-700">{pendingCitas.length}</p>
              </article>
            </div>

            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Cronograma</h3>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-full border border-slate-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todas">Todas</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="cancelada">Canceladas</option>
                  <option value="completada">Completadas</option>
                </select>
                <div className="flex rounded-full border border-slate-100 bg-white p-1 text-sm font-semibold shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("hoy")}
                    className={`rounded-full px-4 py-2 ${viewMode === "hoy" ? "bg-blue-700 text-white" : "text-slate-500"}`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("semana")}
                    className={`rounded-full px-4 py-2 ${viewMode === "semana" ? "bg-blue-700 text-white" : "text-slate-500"}`}
                  >
                    Todas
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">Cargando agenda...</div>
            ) : visibleCitas.length > 0 ? (
              <div className="space-y-4">
                {visibleCitas.map((cita) => {
                  const isPending = cita.estado === "pendiente"

                  return (
                    <article
                      key={cita.id_cita}
                      className="rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => openDetail(cita)}
                        className="flex w-full items-center gap-5 p-5 text-left"
                      >
                        <div className="w-20 text-center">
                          <p className={`text-lg font-semibold ${isPending ? "text-blue-700" : "text-slate-400"}`}>
                            {timeText(cita.hora_inicio)}
                          </p>
                          <p className="text-[10px] font-bold uppercase text-slate-400">
                            {cita.fecha === today ? "Hoy" : formatDay(cita.fecha)}
                          </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {cita.paciente?.nombre?.[0] || "P"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">{cita.paciente?.nombre_completo}</h4>
                          <p className="truncate text-sm text-slate-500">{cita.motivo}</p>
                        </div>

                        <span className={`rounded-md px-3 py-2 text-xs font-bold uppercase ${statusClass(cita.estado)}`}>
                          {statusLabel(cita.estado)}
                        </span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openDetail(cita)
                          }}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800"
                          aria-label="Ver detalle de cita"
                        >
                          &gt;
                        </button>
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
                <h4 className="text-lg font-semibold">No hay citas para mostrar</h4>
                <p className="mt-2 text-sm text-slate-500">Cambia el filtro o busca otro paciente.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {selectedCita && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-6">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-gray-50 shadow-2xl">
            <header className="relative flex flex-wrap items-center justify-center gap-4 border-b border-slate-100 bg-white px-8 py-5">
              <button
                type="button"
                onClick={() => setSelectedCita(null)}
                className="absolute left-8 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-xl font-semibold text-slate-600 hover:bg-slate-100"
                aria-label="Volver a agenda"
              >
                &lt;
              </button>
              <div className="w-full text-center">
                <h2 className="text-2xl font-semibold">Detalle de cita</h2>
                <p className="mt-1 text-sm font-semibold text-blue-700">
                  Proxima: {timeText(nextCita?.hora_inicio) || "--:--"} hs
                </p>
              </div>
            </header>

            <div className="p-8">
              <div className="mx-auto max-w-4xl space-y-6">
                <article className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-5">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-blue-700">
                        {selectedCita.paciente?.nombre?.[0] || "P"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-3xl font-semibold">{selectedCita.paciente?.nombre_completo}</h3>
                        <p className="text-sm font-semibold text-slate-400">
                          ID: {selectedCita.paciente?.id_paciente?.slice(0, 8) || "N/A"} - Paciente
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Estado
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                        {statusLabel(selectedCita.estado)}
                      </span>
                      <p className="mt-3 text-sm font-semibold capitalize text-slate-600">
                        {selectedCita.fecha === today ? "Hoy" : formatLongDate(selectedCita.fecha)}
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-800">
                        {timeText(selectedCita.hora_inicio)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Motivo de consulta
                      </p>
                      <p className="text-lg font-semibold leading-relaxed text-slate-800">
                        {selectedCita.motivo || "Sin motivo registrado."}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Ultima visita
                      </p>
                      <p className="text-lg font-semibold text-slate-800">
                        {selectedCita.estado === "completada" ? formatDay(selectedCita.fecha) : "Sin registro"}
                      </p>
                    </div>
                  </div>
                </article>

                <div className="flex flex-wrap justify-center gap-3">
                  {selectedCita.estado === "pendiente" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleComplete(selectedCita)}
                      className="rounded-xl bg-emerald-600 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                      Completar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={selectedCita.estado !== "pendiente" || saving}
                    onClick={() => handleCancel(selectedCita)}
                    className="rounded-xl bg-blue-600 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={selectedCita.estado !== "pendiente" || saving}
                    onClick={() => openReschedule(selectedCita)}
                    className="rounded-xl bg-blue-600 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    Reagendar
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {modalCita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <form onSubmit={handleReschedule} className="w-full max-w-2xl rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-semibold">Reagendar cita</h2>
            <p className="mt-2 text-sm text-slate-500">
              {modalCita.paciente?.nombre_completo} - {modalCita.motivo}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">Nueva fecha</label>
                <input
                  type="date"
                  value={nuevaFecha}
                  min={today}
                  onChange={(event) => setNuevaFecha(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">Duracion</label>
                <select
                  value={duracion}
                  onChange={(event) => setDuracion(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="30">30 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-sm font-bold text-slate-600">Horario disponible</p>
              {loadingHorarios ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Consultando horarios...</p>
              ) : horarios.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {horarios.map((horario) => (
                    <button
                      type="button"
                      key={`${horario.hora_inicio}-${horario.hora_fin}`}
                      onClick={() => setNuevaHora(horario.hora_inicio)}
                      className={`rounded-xl border py-3 text-sm font-bold ${
                        nuevaHora === horario.hora_inicio
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-slate-200 text-slate-600 hover:border-blue-500"
                      }`}
                    >
                      {horario.hora_inicio}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No hay horarios disponibles para esta fecha.
                </p>
              )}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setModalCita(null)}
                className="rounded-xl bg-slate-100 py-4 font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-700 py-4 font-semibold text-white shadow-lg hover:bg-blue-800 disabled:bg-blue-300"
              >
                {saving ? "Guardando..." : "Guardar cambio"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
