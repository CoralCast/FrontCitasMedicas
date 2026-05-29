import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  clearSession,
  completeCita,
  createBloqueoDoctor,
  createDoctor,
  createHorarioDoctor,
  deleteBloqueoDoctor,
  deleteHorarioDoctor,
  getBloqueosDoctor,
  getCitaClinica,
  getCitasClinica,
  getDoctorAdmin,
  getDoctoresAdmin,
  getEspecialidades,
  getHorariosDoctor,
  getPacienteClinica,
  getPacientesClinica,
  getStoredUser,
  updateDoctor,
  updateDoctorEstado,
} from "../services/api"

const today = new Date().toISOString().slice(0, 10)

const emptyDoctorForm = {
  nombre: "",
  apellido: "",
  curp: "",
  correo: "",
  telefono: "",
  password: "",
  id_especialidad: "",
  monto_consulta: "",
}

const emptyHorarioForm = {
  dia: "2",
  hora_inicio: "09:00",
  hora_fin: "14:00",
}

const emptyBloqueoForm = {
  fecha_inicio: `${today}T09:00`,
  fecha_fin: `${today}T10:00`,
}

const dias = {
  1: "Domingo",
  2: "Lunes",
  3: "Martes",
  4: "Miercoles",
  5: "Jueves",
  6: "Viernes",
  7: "Sabado",
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Sin precio"

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value))
}

function formatDateTime(value) {
  if (!value) return "Sin fecha"

  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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

export default function Admin() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState("resumen")
  const [doctores, setDoctores] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [citas, setCitas] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [summaryFilter, setSummaryFilter] = useState("agenda")
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("todas")
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm)
  const [editForm, setEditForm] = useState(null)
  const [selectedCita, setSelectedCita] = useState(null)
  const [selectedDoctorDetail, setSelectedDoctorDetail] = useState(null)
  const [selectedPaciente, setSelectedPaciente] = useState(null)
  const [horarioForm, setHorarioForm] = useState(emptyHorarioForm)
  const [bloqueoForm, setBloqueoForm] = useState(emptyBloqueoForm)
  const [horarios, setHorarios] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCita, setLoadingCita] = useState(false)
  const [loadingDoctorDetail, setLoadingDoctorDetail] = useState(false)
  const [loadingPaciente, setLoadingPaciente] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingDoctorData, setLoadingDoctorData] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const selectedDoctor = useMemo(
    () => doctores.find((doctor) => doctor.id_doctor === selectedDoctorId),
    [doctores, selectedDoctorId],
  )

  const activeDoctors = doctores.filter((doctor) => doctor.activo)
  const inactiveDoctors = doctores.filter((doctor) => !doctor.activo)
  const citasOrdenadas = useMemo(() => sortClosestCitas(citas), [citas])
  const citasHoy = citasOrdenadas.filter((cita) => cita.fecha === today)
  const citasPendientes = citasOrdenadas.filter((cita) => cita.estado === "pendiente")
  const citasResumen = useMemo(() => {
    const base = summaryFilter === "todayAppointments" ? citasHoy : citasOrdenadas

    return appointmentStatusFilter === "todas"
      ? base
      : base.filter((cita) => cita.estado === appointmentStatusFilter)
  }, [appointmentStatusFilter, citasHoy, citasOrdenadas, summaryFilter])
  const summaryTitle = {
    agenda: "Actividad de agenda",
    activeDoctors: "Doctores activos",
    inactiveDoctors: "Doctores inactivos",
    patients: "Pacientes registrados",
    todayAppointments: "Citas de hoy",
  }[summaryFilter]
  async function loadDashboard() {
    setLoading(true)
    setError("")

    try {
      const [doctoresData, pacientesData, citasData, especialidadesData] = await Promise.all([
        getDoctoresAdmin(),
        getPacientesClinica(),
        getCitasClinica(),
        getEspecialidades(),
      ])
      setDoctores(doctoresData)
      setPacientes(pacientesData)
      setCitas(citasData)
      setEspecialidades(especialidadesData)
      setSelectedDoctorId((current) => current || doctoresData[0]?.id_doctor || "")
      setDoctorForm((current) => ({
        ...current,
        id_especialidad: current.id_especialidad || especialidadesData[0]?.id_especialidad || "",
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadDoctorData = useCallback(async (idDoctor = selectedDoctorId) => {
    if (!idDoctor) {
      setHorarios([])
      setBloqueos([])
      return
    }

    setLoadingDoctorData(true)
    setError("")

    try {
      const [horariosData, bloqueosData] = await Promise.all([
        getHorariosDoctor(idDoctor),
        getBloqueosDoctor(idDoctor),
      ])
      setHorarios(horariosData)
      setBloqueos(bloqueosData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDoctorData(false)
    }
  }, [selectedDoctorId])

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard()
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      loadDoctorData(selectedDoctorId)
    })
  }, [loadDoctorData, selectedDoctorId])

  function logout() {
    clearSession()
    navigate("/", { replace: true })
  }

  function updateDoctorForm(field, value) {
    setDoctorForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function startEditDoctor(doctor) {
    setEditForm({
      id_doctor: doctor.id_doctor,
      nombre: doctor.nombre || "",
      apellido: doctor.apellido || "",
      curp: doctor.curp || "",
      id_especialidad: doctor.id_especialidad || especialidades[0]?.id_especialidad || "",
      monto_consulta: doctor.precio_consulta || "",
    })
    setActiveView("doctores")
    setNotice("")
    setError("")
  }

  async function handleCreateDoctor(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    try {
      await createDoctor({
        ...doctorForm,
        curp: doctorForm.curp.trim().toUpperCase(),
        monto_consulta: Number(doctorForm.monto_consulta),
      })
      setDoctorForm({
        ...emptyDoctorForm,
        id_especialidad: especialidades[0]?.id_especialidad || "",
      })
      setNotice("Doctor registrado correctamente.")
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateDoctor(event) {
    event.preventDefault()
    if (!editForm) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      await updateDoctor(editForm.id_doctor, {
        nombre: editForm.nombre,
        apellido: editForm.apellido,
        curp: editForm.curp.trim().toUpperCase(),
        id_especialidad: editForm.id_especialidad,
        monto_consulta: Number(editForm.monto_consulta),
      })
      setNotice("Doctor actualizado correctamente.")
      setEditForm(null)
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDoctorStatus(doctor) {
    setSaving(true)
    setError("")
    setNotice("")

    try {
      await updateDoctorEstado(doctor.id_doctor, !doctor.activo)
      setNotice(doctor.activo ? "Doctor desactivado." : "Doctor activado.")
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function openPacienteDetail(idPaciente) {
    setLoadingPaciente(true)
    setError("")
    setNotice("")

    try {
      const data = await getPacienteClinica(idPaciente)
      setSelectedPaciente(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPaciente(false)
    }
  }

  async function openCitaDetail(idCita) {
    setLoadingCita(true)
    setError("")
    setNotice("")

    try {
      const data = await getCitaClinica(idCita)
      setSelectedCita(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingCita(false)
    }
  }

  async function openDoctorDetail(idDoctor) {
    setLoadingDoctorDetail(true)
    setError("")
    setNotice("")

    try {
      const data = await getDoctorAdmin(idDoctor)
      setSelectedDoctorDetail(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDoctorDetail(false)
    }
  }

  async function handleCompleteCita(cita) {
    setSaving(true)
    setError("")
    setNotice("")

    try {
      await completeCita(cita.id_cita)
      setNotice("Cita marcada como completada correctamente.")
      setSelectedCita(null)
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateHorario(event) {
    event.preventDefault()
    if (!selectedDoctorId) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      await createHorarioDoctor(selectedDoctorId, {
        dia: Number(horarioForm.dia),
        hora_inicio: horarioForm.hora_inicio,
        hora_fin: horarioForm.hora_fin,
      })
      setNotice("Horario creado correctamente.")
      setHorarioForm(emptyHorarioForm)
      await loadDoctorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHorario(idHorario) {
    setSaving(true)
    setError("")
    setNotice("")

    try {
      await deleteHorarioDoctor(idHorario)
      setNotice("Horario eliminado correctamente.")
      await loadDoctorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateBloqueo(event) {
    event.preventDefault()
    if (!selectedDoctorId) return

    setSaving(true)
    setError("")
    setNotice("")

    try {
      await createBloqueoDoctor(selectedDoctorId, bloqueoForm)
      setNotice("Bloqueo creado correctamente.")
      setBloqueoForm(emptyBloqueoForm)
      await loadDoctorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBloqueo(idBloqueo) {
    setSaving(true)
    setError("")
    setNotice("")

    try {
      await deleteBloqueoDoctor(idBloqueo)
      setNotice("Bloqueo eliminado correctamente.")
      await loadDoctorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`min-h-screen bg-gray-100 text-slate-900 ${sidebarOpen ? "sidebar-open" : ""}`}>
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
      <div className="flex min-h-screen bg-white shadow-sm">
        <aside className="app-sidebar sticky top-0 grid h-screen w-72 shrink-0 grid-rows-[1fr_auto] border-r border-slate-100 bg-white px-6 py-8">
          <div>

            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold">Administracion</p>
              <p className="text-xs font-semibold uppercase text-slate-400">
                {user?.correo || "admin"}
              </p>
            </div>

            <nav className="space-y-3">
              {[
                ["resumen", "Resumen"],
                ["doctores", "Doctores"],
                ["horarios", "Horarios"],
                ["bloqueos", "Bloqueos"],
              ].map(([view, label], index) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    activeView === view ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${
                      activeView === view ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-800"
          >
            Cerrar sesion
          </button>
        </aside>

        <main className="flex-1 bg-gray-50">
          <header className="border-b border-slate-100 bg-white px-8 py-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="w-full text-center">
                <h2 className="text-3xl font-semibold">Panel administrativo</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Gestiona doctores, horarios y bloqueos de agenda.
                </p>
              </div>

              {(activeView === "horarios" || activeView === "bloqueos") && (
                <select
                  value={selectedDoctorId}
                  onChange={(event) => setSelectedDoctorId(event.target.value)}
                  className="w-full max-w-sm rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar doctor</option>
                  {doctores.map((doctor) => (
                    <option key={doctor.id_doctor} value={doctor.id_doctor}>
                      {doctor.nombre_completo} - {doctor.especialidad || "Sin especialidad"}
                    </option>
                  ))}
                </select>
              )}
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

            {loading ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-slate-500 shadow-sm">
                Cargando administracion...
              </div>
            ) : (
              <>
                {activeView === "resumen" && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => setSummaryFilter("activeDoctors")}
                        className={`admin-summary-card rounded-none border p-5 text-left shadow-sm ${
                          summaryFilter === "activeDoctors"
                            ? "admin-summary-card-selected"
                            : "border-slate-100 bg-white hover:border-blue-200"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-500">Doctores activos</p>
                        <p className="mt-4 text-4xl font-semibold">{activeDoctors.length}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryFilter("inactiveDoctors")}
                        className={`admin-summary-card rounded-none border p-5 text-left shadow-sm ${
                          summaryFilter === "inactiveDoctors"
                            ? "admin-summary-card-selected"
                            : "border-slate-100 bg-white hover:border-blue-200"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-500">Doctores inactivos</p>
                        <p className="mt-4 text-4xl font-semibold">{inactiveDoctors.length}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryFilter("patients")}
                        className={`admin-summary-card rounded-none border p-5 text-left shadow-sm ${
                          summaryFilter === "patients"
                            ? "admin-summary-card-selected"
                            : "border-slate-100 bg-white hover:border-blue-200"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-500">Pacientes</p>
                        <p className="mt-4 text-4xl font-semibold">{pacientes.length}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryFilter("todayAppointments")}
                        className={`admin-summary-card rounded-none border p-5 text-left shadow-sm ${
                          summaryFilter === "todayAppointments"
                            ? "admin-summary-card-selected"
                            : "border-slate-100 bg-white hover:border-blue-200"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-500">Citas hoy</p>
                        <p className="mt-4 text-4xl font-semibold text-blue-700">{citasHoy.length}</p>
                      </button>
                    </div>

                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-xl font-semibold">{summaryTitle}</h3>
                        <div className="flex flex-wrap items-center gap-3">
                          {(summaryFilter === "agenda" || summaryFilter === "todayAppointments") && (
                            <select
                              value={appointmentStatusFilter}
                              onChange={(event) => setAppointmentStatusFilter(event.target.value)}
                              className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="todas">Todas</option>
                              <option value="pendiente">Pendientes</option>
                              <option value="cancelada">Canceladas</option>
                              <option value="completada">Completadas</option>
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => setSummaryFilter("agenda")}
                            className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700"
                          >
                            {summaryFilter === "agenda" ? `${citasPendientes.length} pendientes` : "Ver agenda"}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        {(summaryFilter === "agenda" || summaryFilter === "todayAppointments") && (
                          <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Paciente</th>
                                <th className="px-4 py-3">Doctor</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Detalle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {citasResumen.slice(0, 8).map((cita) => (
                                <tr key={cita.id_cita}>
                                  <td className="px-4 py-4">
                                    <p className="font-semibold">{cita.fecha}</p>
                                    <p className="text-xs text-slate-500">{cita.hora_inicio}</p>
                                  </td>
                                  <td className="px-4 py-4">{cita.paciente?.nombre_completo}</td>
                                  <td className="px-4 py-4">{cita.doctor?.nombre_completo}</td>
                                  <td className="px-4 py-4">
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                      {cita.estado}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openCitaDetail(cita.id_cita)}
                                      disabled={loadingCita}
                                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:text-slate-400"
                                    >
                                      Ver detalle
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {(summaryFilter === "activeDoctors" || summaryFilter === "inactiveDoctors") && (
                          <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Doctor</th>
                                <th className="px-4 py-3">Especialidad</th>
                                <th className="px-4 py-3">Correo</th>
                                <th className="px-4 py-3">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(summaryFilter === "activeDoctors" ? activeDoctors : inactiveDoctors).map((doctor) => (
                                <tr key={doctor.id_doctor}>
                                  <td className="px-4 py-4 font-semibold">{doctor.nombre_completo}</td>
                                  <td className="px-4 py-4">{doctor.especialidad || "Sin especialidad"}</td>
                                  <td className="px-4 py-4">{doctor.correo}</td>
                                  <td className="px-4 py-4">
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                      {doctor.activo ? "activo" : "inactivo"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {summaryFilter === "patients" && (
                          <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Paciente</th>
                                <th className="px-4 py-3">Parentesco</th>
                                <th className="px-4 py-3">CURP</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Detalle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {pacientes.map((paciente) => (
                                <tr key={paciente.id_paciente}>
                                  <td className="px-4 py-4 font-semibold">{paciente.nombre_completo}</td>
                                  <td className="px-4 py-4">{paciente.parentesco || "Sin parentesco"}</td>
                                  <td className="px-4 py-4">{paciente.curp || "Sin CURP"}</td>
                                  <td className="px-4 py-4">
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                      {paciente.activo ? "activo" : "inactivo"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openPacienteDetail(paciente.id_paciente)}
                                      disabled={loadingPaciente}
                                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:text-slate-400"
                                    >
                                      Ver ficha
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {activeView === "doctores" && (
                  <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-xl font-semibold">Doctores</h3>
                        <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                          {doctores.length} registros
                        </span>
                      </div>
                      <div className="space-y-3">
                        {doctores.map((doctor) => (
                          <article
                            key={doctor.id_doctor}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div>
                              <p className="font-semibold">{doctor.nombre_completo}</p>
                              <p className="text-sm text-slate-500">
                                {doctor.especialidad || "Sin especialidad"} · {formatMoney(doctor.precio_consulta)}
                              </p>
                              <p className="text-xs text-slate-400">{doctor.correo}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openDoctorDetail(doctor.id_doctor)}
                                disabled={loadingDoctorDetail}
                                className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:text-slate-400"
                              >
                                Ver ficha
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditDoctor(doctor)}
                                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleDoctorStatus(doctor)}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                  doctor.activo
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {doctor.activo ? "Desactivar" : "Activar"}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold">
                        {editForm ? "Editar doctor" : "Registrar doctor"}
                      </h3>
                      <form
                        onSubmit={editForm ? handleUpdateDoctor : handleCreateDoctor}
                        className="mt-5 space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <input
                            value={editForm?.nombre ?? doctorForm.nombre}
                            onChange={(event) =>
                              editForm
                                ? updateEditForm("nombre", event.target.value)
                                : updateDoctorForm("nombre", event.target.value)
                            }
                            placeholder="Nombre"
                            className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                          <input
                            value={editForm?.apellido ?? doctorForm.apellido}
                            onChange={(event) =>
                              editForm
                                ? updateEditForm("apellido", event.target.value)
                                : updateDoctorForm("apellido", event.target.value)
                            }
                            placeholder="Apellido"
                            className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <input
                          value={editForm?.curp ?? doctorForm.curp}
                          onChange={(event) =>
                            editForm
                              ? updateEditForm("curp", event.target.value)
                              : updateDoctorForm("curp", event.target.value)
                          }
                          placeholder="CURP"
                          minLength={18}
                          maxLength={18}
                          className="w-full rounded-xl bg-slate-100 px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        {!editForm && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <input
                              type="email"
                              value={doctorForm.correo}
                              onChange={(event) => updateDoctorForm("correo", event.target.value)}
                              placeholder="Correo"
                              className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                            <input
                              value={doctorForm.telefono}
                              onChange={(event) => updateDoctorForm("telefono", event.target.value)}
                              placeholder="Telefono"
                              className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                            <input
                              type="password"
                              value={doctorForm.password}
                              onChange={(event) => updateDoctorForm("password", event.target.value)}
                              placeholder="Contrasena"
                              className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
                              required
                            />
                          </div>
                        )}
                        <select
                          value={editForm?.id_especialidad ?? doctorForm.id_especialidad}
                          onChange={(event) =>
                            editForm
                              ? updateEditForm("id_especialidad", event.target.value)
                              : updateDoctorForm("id_especialidad", event.target.value)
                          }
                          className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Especialidad</option>
                          {especialidades.map((especialidad) => (
                            <option
                              key={especialidad.id_especialidad}
                              value={especialidad.id_especialidad}
                            >
                              {especialidad.especialidad}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={editForm?.monto_consulta ?? doctorForm.monto_consulta}
                          onChange={(event) =>
                            editForm
                              ? updateEditForm("monto_consulta", event.target.value)
                              : updateDoctorForm("monto_consulta", event.target.value)
                          }
                          placeholder="Precio de consulta"
                          className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <div className="grid grid-cols-2 gap-3">
                          {editForm && (
                            <button
                              type="button"
                              onClick={() => setEditForm(null)}
                              className="rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={saving}
                            className={`${editForm ? "" : "col-span-2"} rounded-xl bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300`}
                          >
                            {saving ? "Guardando..." : editForm ? "Guardar cambios" : "Crear doctor"}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>
                )}

                {activeView === "horarios" && (
                  <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold">
                        Horarios de {selectedDoctor?.nombre_completo || "doctor"}
                      </h3>
                      {loadingDoctorData ? (
                        <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                          Cargando horarios...
                        </p>
                      ) : (
                        <div className="mt-5 space-y-3">
                          {horarios.map((horario) => (
                            <article
                              key={horario.id_horario}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                              <div>
                                <p className="font-semibold">{dias[horario.dia]}</p>
                                <p className="text-sm text-slate-500">
                                  {horario.hora_inicio} - {horario.hora_fin}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleDeleteHorario(horario.id_horario)}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                              >
                                Eliminar
                              </button>
                            </article>
                          ))}
                          {horarios.length === 0 && (
                            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                              Este doctor no tiene horarios configurados.
                            </p>
                          )}
                        </div>
                      )}
                    </section>

                    <form
                      onSubmit={handleCreateHorario}
                      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
                    >
                      <h3 className="text-xl font-semibold">Nuevo horario</h3>
                      <div className="mt-5 space-y-4">
                        <select
                          value={horarioForm.dia}
                          onChange={(event) =>
                            setHorarioForm((current) => ({ ...current, dia: event.target.value }))
                          }
                          className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(dias).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-4 md:grid-cols-2">
                          <input
                            type="time"
                            value={horarioForm.hora_inicio}
                            onChange={(event) =>
                              setHorarioForm((current) => ({
                                ...current,
                                hora_inicio: event.target.value,
                              }))
                            }
                            className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="time"
                            value={horarioForm.hora_fin}
                            onChange={(event) =>
                              setHorarioForm((current) => ({
                                ...current,
                                hora_fin: event.target.value,
                              }))
                            }
                            className="rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={saving || !selectedDoctorId}
                          className="w-full rounded-xl bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
                        >
                          Crear horario
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {activeView === "bloqueos" && (
                  <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold">
                        Dias ausentes de {selectedDoctor?.nombre_completo || "doctor"}
                      </h3>
                      {loadingDoctorData ? (
                        <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                          Cargando dias ausentes
                        </p>
                      ) : (
                        <div className="mt-5 space-y-3">
                          {bloqueos.map((bloqueo) => (
                            <article
                              key={bloqueo.id_bloqueo}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                              <div>
                                <p className="font-semibold">{formatDateTime(bloqueo.fecha_inicio)}</p>
                                <p className="text-sm text-slate-500">
                                  Hasta {formatDateTime(bloqueo.fecha_fin)}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleDeleteBloqueo(bloqueo.id_bloqueo)}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                              >
                                Eliminar
                              </button>
                            </article>
                          ))}
                          {bloqueos.length === 0 && (
                            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                              No hay bloqueos registrados para este doctor.
                            </p>
                          )}
                        </div>
                      )}
                    </section>

                    <form
                      onSubmit={handleCreateBloqueo}
                      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
                    >
                      <h3 className="text-xl font-semibold">Nuevo bloqueo</h3>
                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-600">
                            Inicio
                          </label>
                          <input
                            type="datetime-local"
                            value={bloqueoForm.fecha_inicio}
                            onChange={(event) =>
                              setBloqueoForm((current) => ({
                                ...current,
                                fecha_inicio: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-600">
                            Fin
                          </label>
                          <input
                            type="datetime-local"
                            value={bloqueoForm.fecha_fin}
                            onChange={(event) =>
                              setBloqueoForm((current) => ({
                                ...current,
                                fecha_fin: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={saving || !selectedDoctorId}
                          className="w-full rounded-xl bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
                        >
                          Crear bloqueo
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>

      {selectedPaciente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">Ficha de paciente</p>
                <h3 className="mt-1 text-2xl font-semibold">{selectedPaciente.nombre_completo}</h3>
                <p className="text-sm font-semibold text-slate-500">
                  ID: {selectedPaciente.id_paciente}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase text-blue-700">
                {selectedPaciente.activo ? "activo" : "inactivo"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Nombre</p>
                <p className="mt-1 font-semibold">{selectedPaciente.nombre || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Apellido</p>
                <p className="mt-1 font-semibold">{selectedPaciente.apellido || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Sexo</p>
                <p className="mt-1 font-semibold">{selectedPaciente.sexo || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Fecha de nacimiento</p>
                <p className="mt-1 font-semibold">{selectedPaciente.fecha_nacimiento || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">CURP</p>
                <p className="mt-1 font-semibold">{selectedPaciente.curp || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Parentesco</p>
                <p className="mt-1 font-semibold">{selectedPaciente.parentesco || "Sin dato"}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPaciente(null)}
                className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedCita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">Detalle de cita</p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {selectedCita.paciente?.nombre_completo || "Paciente sin dato"}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  ID: {selectedCita.id_cita}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase text-blue-700">
                {selectedCita.estado || "sin estado"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Paciente</p>
                <p className="mt-1 font-semibold">{selectedCita.paciente?.nombre_completo || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Doctor</p>
                <p className="mt-1 font-semibold">{selectedCita.doctor?.nombre_completo || "Sin dato"}</p>
                <p className="text-sm text-slate-500">{selectedCita.doctor?.especialidad || "Sin especialidad"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Fecha</p>
                <p className="mt-1 font-semibold">{selectedCita.fecha || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Horario</p>
                <p className="mt-1 font-semibold">
                  {timeText(selectedCita.hora_inicio) || "Sin hora"} - {timeText(selectedCita.hora_fin) || "Sin hora"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase text-slate-500">Motivo</p>
                <p className="mt-1 font-semibold">{selectedCita.motivo || "Sin motivo registrado"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {selectedCita.estado === "pendiente" && (
                <button
                  type="button"
                  onClick={() => handleCompleteCita(selectedCita)}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                >
                  Completar cita
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCita(null)}
                className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedDoctorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">Ficha de doctor</p>
                <h3 className="mt-1 text-2xl font-semibold">{selectedDoctorDetail.nombre_completo}</h3>
                <p className="text-sm font-semibold text-slate-500">
                  ID: {selectedDoctorDetail.id_doctor}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase text-blue-700">
                {selectedDoctorDetail.activo ? "activo" : "inactivo"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Nombre</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.nombre || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Apellido</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.apellido || "Sin dato"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Especialidad</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.especialidad || "Sin especialidad"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Precio de consulta</p>
                <p className="mt-1 font-semibold">{formatMoney(selectedDoctorDetail.precio_consulta)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Correo</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.correo || "Sin correo"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Telefono</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.telefono || "Sin telefono"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">CURP</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.curp || "Sin CURP"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Fecha de baja</p>
                <p className="mt-1 font-semibold">{selectedDoctorDetail.fecha_baja || "Sin baja"}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDoctorDetail(null)}
                className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
