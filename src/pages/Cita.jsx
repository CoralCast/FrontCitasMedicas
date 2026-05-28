import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  clearSession,
  createCita,
  createPaciente,
  getDisponibilidad,
  getDoctores,
  getParentescos,
  getPacientes,
  getStoredUser,
} from "../services/api"

const initialPatientForm = {
  nombre: "",
  apellido: "",
  sexo: "femenino",
  fecha_nacimiento: "",
  curp: "",
  parentesco: "hijo",
}

function formatDate(fecha) {
  if (!fecha) return "Selecciona una fecha"

  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatMoney(value) {
  if (value === null || value === undefined) return "Por definir"

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value)
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function todayKey() {
  return toDateKey(new Date())
}

function getMonthLabel(date) {
  return date.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  })
}

function getCalendarDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  const leadingDays = firstDay.getDay()
  const days = Array.from({ length: leadingDays }, () => null)

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(new Date(year, month, day))
  }

  return days
}

export default function Cita() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState("")
  const [mostrarModal, setMostrarModal] = useState(false)
  const [patientForm, setPatientForm] = useState(initialPatientForm)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState("")
  const [doctorSeleccionado, setDoctorSeleccionado] = useState("")
  const [pacientes, setPacientes] = useState([])
  const [doctores, setDoctores] = useState([])
  const [parentescos, setParentescos] = useState([])
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [horariosBloques, setHorariosBloques] = useState([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const paciente = useMemo(
    () => pacientes.find((item) => item.id_paciente === pacienteSeleccionado),
    [pacienteSeleccionado, pacientes],
  )
  const doctor = useMemo(
    () => doctores.find((item) => item.id_doctor === doctorSeleccionado),
    [doctorSeleccionado, doctores],
  )
  const especialidades = useMemo(
    () => [...new Set(doctores.map((item) => item.especialidad).filter(Boolean))],
    [doctores],
  )

  const fechaFormateada = formatDate(fecha)
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const selectedDateNoSchedule =
    Boolean(doctorSeleccionado && fecha && !loadingHorarios && horariosBloques.length === 0)
  const selectedDateAllBlocked =
    Boolean(doctorSeleccionado && fecha && !loadingHorarios && horariosBloques.length > 0 && horarios.length === 0)
  const selectedDateHasNoAvailability = selectedDateNoSchedule || selectedDateAllBlocked
  const hasBlockedHours = horariosBloques.some((item) => !item.disponible)

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError("")

      try {
        // Flujo de la guia para agendar:
        // 1. GET /pacientes/me
        // 2. GET /catalogos/doctores
        // 3. GET /catalogos/parentescos para el dropdown de paciente
        const [pacientesData, doctoresData, parentescosData] = await Promise.all([
          getPacientes(),
          getDoctores(),
          getParentescos(),
        ])
        const activos = pacientesData.filter((item) => item.activo)

        setPacientes(activos)
        setDoctores(doctoresData)
        setParentescos(parentescosData)
        setPacienteSeleccionado(activos[0]?.id_paciente || "")
        setDoctorSeleccionado(doctoresData[0]?.id_doctor || "")
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadAvailability() {
      if (!doctorSeleccionado || !fecha) {
        setHorarios([])
        setHorariosBloques([])
        setHora("")
        return
      }

      setLoadingHorarios(true)
      setError("")

      try {
        // Guia: al elegir doctor y fecha se consulta disponibilidad.
        // El backend responde horarios_disponibles para pintarlos como botones.
        const disponibilidad = await getDisponibilidad(doctorSeleccionado, fecha)
        const libres = disponibilidad.horarios_disponibles || []
        setHorarios(libres)
        setHorariosBloques(
          disponibilidad.horarios ||
            libres.map((item) => ({
              ...item,
              estado: "disponible",
              disponible: true,
            })),
        )
        setHora("")
      } catch (err) {
        setHorarios([])
        setHorariosBloques([])
        setError(err.message)
      } finally {
        setLoadingHorarios(false)
      }
    }

    loadAvailability()
  }, [doctorSeleccionado, fecha])

  function logout() {
    clearSession()
    navigate("/", { replace: true })
  }

  function updatePatientForm(field, value) {
    setPatientForm((current) => ({ ...current, [field]: value }))
  }

  function changeCalendarMonth(offset) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function selectCalendarDate(dateKey) {
    setFecha(dateKey)
    setHora("")
  }

  async function agregarPaciente(event) {
    event.preventDefault()
    setError("")
    setNotice("")

    try {
      // Guia: POST /pacientes recibe estos campos y el backend toma
      // id_usuario e id_clinica_tenant desde el token JWT.
      const created = await createPaciente({
        ...patientForm,
        curp: patientForm.curp.trim().toUpperCase(),
      })
      setPacientes((current) => [...current, created])
      setPacienteSeleccionado(created.id_paciente)
      setPatientForm(initialPatientForm)
      setMostrarModal(false)
      setNotice("Paciente agregado correctamente.")
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmarCita() {
    setError("")
    setNotice("")

    if (!pacienteSeleccionado || !doctorSeleccionado || !fecha || !hora || !motivo.trim()) {
      setError("Completa paciente, doctor, fecha, horario y motivo de consulta.")
      return
    }

    setSaving(true)

    try {
      // Guia: para cliente se manda id_paciente, id_doctor, fecha,
      // hora_inicio y motivo. No se manda hora_fin.
      const cita = await createCita({
        id_paciente: pacienteSeleccionado,
        id_doctor: doctorSeleccionado,
        fecha,
        hora_inicio: hora,
        motivo: motivo.trim(),
      })

      navigate("/confirmacion", { state: { cita } })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`appointment-page min-h-screen bg-gray-100 flex ${sidebarOpen ? "sidebar-open" : ""}`}>
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
      <aside className="app-sidebar appointment-sidebar w-72 bg-white border-r border-slate-100 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
              {user?.correo?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">
                {user?.correo || "Usuario"}
              </h2>
              <p className="text-sm text-gray-500">{user?.rol || "cliente"}</p>
            </div>
          </div>

          <nav className="space-y-3">
            <Link
              to="/cita"
              className="appointment-nav-item block w-full text-left bg-blue-50 text-blue-700 font-semibold px-4 py-3 rounded-xl"
            >
              Agendar Cita
            </Link>
            <Link
              to="/historial"
              className="appointment-nav-item block w-full text-left text-gray-600 hover:bg-gray-100 px-4 py-3 rounded-xl"
            >
              Historial
            </Link>
          </nav>
        </div>

        <button
          type="button"
          onClick={logout}
          className="appointment-logout block w-full text-left text-red-500 hover:bg-red-50 px-4 py-3 rounded-xl"
        >
          Cerrar sesion
        </button>
      </aside>

      <main className="appointment-main flex-1 p-8">
        <div className="appointment-header flex justify-between items-center mb-8 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Agendar nueva cita</h1>
            <p className="text-gray-500">Completa los datos para confirmar tu cita medica</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {paciente?.nombre_completo?.[0] || "P"}
            </div>
            <span className="font-medium">{paciente?.nombre_completo || "Sin paciente"}</span>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {notice}
          </p>
        )}

        {loading ? (
          <div className="appointment-card bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">Cargando datos...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="appointment-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-6">Informacion de la cita</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-600">
                        PARA QUIEN ES LA CITA?
                      </label>
                      <button
                        type="button"
                        onClick={() => setMostrarModal(true)}
                        className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold flex items-center justify-center"
                        aria-label="Agregar paciente"
                      >
                        +
                      </button>
                    </div>

                    <select
                      value={pacienteSeleccionado}
                      onChange={(event) => setPacienteSeleccionado(event.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none"
                    >
                      <option value="">Selecciona un paciente</option>
                      {pacientes.map((item) => (
                        <option key={item.id_paciente} value={item.id_paciente}>
                          {item.nombre_completo} ({item.parentesco})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-2">
                      ESPECIALIDADES DISPONIBLES
                    </label>
                    <select className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none" value={doctor?.especialidad || ""} disabled>
                      <option>{doctor?.especialidad || especialidades[0] || "Sin especialidades"}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-4">
                    SELECCIONA TU ESPECIALISTA
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doctores.map((item) => (
                      <button
                        type="button"
                        key={item.id_doctor}
                        onClick={() => setDoctorSeleccionado(item.id_doctor)}
                        className={`rounded-2xl p-4 flex items-center justify-between text-left cursor-pointer transition-all ${
                          doctorSeleccionado === item.id_doctor
                            ? "border-2 border-blue-500 bg-blue-50"
                            : "border border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {item.nombre_completo?.[0] || "D"}
                          </div>
                          <div>
                            <h3 className="font-semibold">{item.nombre_completo}</h3>
                            <p className="text-sm text-gray-500">{item.especialidad}</p>
                          </div>
                        </div>
                        {doctorSeleccionado === item.id_doctor && (
                          <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="appointment-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-6">Fecha y hora</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold mb-4">Selecciona la fecha</h3>
                    <div className="appointment-calendar">
                      <div className="appointment-calendar-header">
                        <button
                          type="button"
                          onClick={() => changeCalendarMonth(-1)}
                          aria-label="Mes anterior"
                        >
                          &lt;
                        </button>
                        <strong className="capitalize">{getMonthLabel(calendarMonth)}</strong>
                        <button
                          type="button"
                          onClick={() => changeCalendarMonth(1)}
                          aria-label="Mes siguiente"
                        >
                          &gt;
                        </button>
                      </div>

                      <div className="appointment-calendar-weekdays">
                        {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>

                      <div className="appointment-calendar-grid">
                        {calendarDays.map((day, index) => {
                          if (!day) {
                            return <span key={`blank-${index}`} className="appointment-calendar-empty" />
                          }

                          const dateKey = toDateKey(day)
                          const status = dateKey < todayKey() ? "past" : "available"
                          const isSelected = fecha === dateKey
                          const disabled = status === "past"
                          const className = [
                            "appointment-calendar-day",
                            status || "loading",
                            isSelected ? "selected" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")

                          return (
                            <button
                              type="button"
                              key={dateKey}
                              onClick={() => selectCalendarDate(dateKey)}
                              disabled={disabled}
                              className={className}
                            >
                              {day.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">Fecha seleccionada:</p>
                    <p className="font-semibold text-gray-800 capitalize">{fechaFormateada}</p>
                    {selectedDateHasNoAvailability && (
                      <p className="appointment-unavailable-message">
                        {selectedDateAllBlocked
                          ? "Todos los horarios de esta fecha ya estan ocupados o bloqueados."
                          : "Este doctor no tiene horario registrado para esta fecha."}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Horarios Disponibles</h3>
                    {loadingHorarios ? (
                      <p className="text-gray-500">Consultando disponibilidad...</p>
                    ) : horariosBloques.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {horariosBloques.map((time) => (
                          <button
                            type="button"
                            key={`${time.hora_inicio}-${time.hora_fin}`}
                            onClick={() => time.disponible && setHora(time.hora_inicio)}
                            disabled={!time.disponible}
                            className={`appointment-time-button border rounded-xl py-3 ${
                              !time.disponible
                                ? "occupied"
                                : hora === time.hora_inicio
                                  ? "selected"
                                  : "available"
                            }`}
                          >
                            {time.hora_inicio}
                            {!time.disponible && (
                              <span>{time.estado === "bloqueado" ? "Bloqueado" : "Ocupado"}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : selectedDateHasNoAvailability ? (
                      <p className="appointment-unavailable-message">
                        {selectedDateAllBlocked
                          ? "Todos los horarios de esta fecha ya estan ocupados o bloqueados."
                          : "Este doctor no tiene horario registrado para la fecha seleccionada."}
                      </p>
                    ) : (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Selecciona doctor y fecha para ver horarios disponibles.
                      </p>
                    )}
                    {hasBlockedHours && horarios.length > 0 && (
                      <p className="appointment-calendar-status">
                        Los horarios en rojo ya estan ocupados o bloqueados.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="appointment-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-6">Detalles adicionales</h2>
                <label className="text-sm font-semibold text-gray-600 block mb-2">
                  DESCRIBE EL MOTIVO DE LA CONSULTA
                </label>
                <textarea
                  rows="5"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Describe brevemente el motivo de la consulta..."
                  className="w-full bg-gray-100 rounded-2xl p-4 outline-none resize-none"
                />
              </section>
            </div>

            <aside className="appointment-summary-wrap">
              <div className="appointment-summary bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-2xl font-semibold mb-6">Resumen de cita</h2>
                <div className="appointment-summary-content space-y-5">
                  <div>
                    <p className="text-sm text-gray-500">PACIENTE</p>
                    <h3 className="font-bold">{paciente?.nombre_completo || "Sin seleccionar"}</h3>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ESPECIALISTA</p>
                    <h3 className="font-bold">{doctor?.nombre_completo || "Sin seleccionar"}</h3>
                    <p className="text-sm text-gray-500">{doctor?.especialidad}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">FECHA Y HORA</p>
                    <h3 className="font-bold capitalize">{fechaFormateada}</h3>
                    <p className="text-gray-500">{hora || "Selecciona un horario"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">DURACION ESTIMADA</p>
                    <h3 className="font-bold">30 minutos</h3>
                  </div>
                  <hr />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-500">Consulta General</p>
                      <p className="text-sm text-gray-400">Pago en consulta</p>
                    </div>
                    <h2 className="text-2xl font-semibold text-blue-600">
                      {formatMoney(doctor?.precio_consulta)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={confirmarCita}
                    disabled={saving}
                    className="block text-center w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-2xl font-semibold shadow-lg"
                  >
                    {saving ? "Agendando..." : "Confirmar y Agendar"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <form onSubmit={agregarPaciente} className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 w-full max-w-2xl">
            <h2 className="text-3xl font-semibold text-gray-800 mb-2">Agregar paciente</h2>
            <p className="text-gray-500 mb-8">Registra los datos que solicita el backend.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Nombre</label>
                <input
                  type="text"
                  value={patientForm.nombre}
                  onChange={(event) => updatePatientForm("nombre", event.target.value)}
                  placeholder="Ej. Ana"
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Apellido</label>
                <input
                  type="text"
                  value={patientForm.apellido}
                  onChange={(event) => updatePatientForm("apellido", event.target.value)}
                  placeholder="Ej. Garcia Lopez"
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={patientForm.fecha_nacimiento}
                  onChange={(event) => updatePatientForm("fecha_nacimiento", event.target.value)}
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">CURP</label>
                <input
                  type="text"
                  value={patientForm.curp}
                  onChange={(event) => updatePatientForm("curp", event.target.value)}
                  placeholder="18 caracteres"
                  minLength={18}
                  maxLength={18}
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Parentesco</label>
                <select
                  value={patientForm.parentesco}
                  onChange={(event) => updatePatientForm("parentesco", event.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {/* Guia: parentesco se obtiene de GET /catalogos/parentescos. */}
                  {(parentescos.length > 0 ? parentescos : [
                    { id_parentesco: "titular", parentesco: "titular" },
                    { id_parentesco: "hijo", parentesco: "hijo" },
                    { id_parentesco: "conyuge", parentesco: "conyuge" },
                  ]).map((item) => (
                    <option key={item.id_parentesco} value={item.parentesco}>
                      {item.parentesco}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Sexo</label>
                <select
                  value={patientForm.sexo}
                  onChange={(event) => updatePatientForm("sexo", event.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {/* Guia: sexo solo acepta masculino, femenino u otro. */}
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold shadow-lg"
              >
                Guardar Paciente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
