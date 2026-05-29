import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cancelCita,
  clearSession,
  completeCita,
  createCita,
  getCitaClinica,
  getCitasClinica,
  getDisponibilidad,
  getDoctorAdmin,
  getDoctoresAdmin,
  getPacienteClinica,
  getPacientesClinica,
  getStoredUser,
  rescheduleCita,
} from "../services/api";

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  id_paciente: "",
  id_doctor: "",
  fecha: today,
  hora_inicio: "",
  motivo: "",
};

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function citaDateTime(cita) {
  return new Date(
    `${cita.fecha}T${timeText(cita.hora_inicio) || "00:00"}`,
  ).getTime();
}

function sortClosestCitas(citas) {
  const now = Date.now();

  return [...citas].sort((a, b) => {
    const aTime = citaDateTime(a);
    const bTime = citaDateTime(b);
    const aUpcoming = aTime >= now;
    const bUpcoming = bTime >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? aTime - bTime : bTime - aTime;
  });
}

function addMinutes(time, minutes = 30) {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);
  return date.toTimeString().slice(0, 5);
}

function formatDate(fecha) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(estado) {
  if (estado === "cancelada") return "bg-red-50 text-red-600";
  if (estado === "completada") return "bg-emerald-50 text-emerald-700";
  return "bg-blue-50 text-blue-700";
}

export default function Recepcion() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [activeView, setActiveView] = useState("agenda");
  const [expandedPatientGroup, setExpandedPatientGroup] = useState("");
  const [selectedCitaDetalle, setSelectedCitaDetalle] = useState(null);
  const [selectedDoctorDetail, setSelectedDoctorDetail] = useState(null);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [selectedCita, setSelectedCita] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    fecha: today,
    hora_inicio: "",
  });
  const [horarios, setHorarios] = useState([]);
  const [horariosReagenda, setHorariosReagenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCita, setLoadingCita] = useState(false);
  const [loadingDoctorDetail, setLoadingDoctorDetail] = useState(false);
  const [loadingPaciente, setLoadingPaciente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingHorariosReagenda, setLoadingHorariosReagenda] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const citasOrdenadas = useMemo(() => sortClosestCitas(citas), [citas]);

  const citasFiltradas = useMemo(() => {
    const search = query.trim().toLowerCase();
    const byStatus =
      statusFilter === "todas"
        ? citasOrdenadas
        : citasOrdenadas.filter((cita) => cita.estado === statusFilter);

    if (!search) return byStatus;

    return byStatus.filter((cita) =>
      [
        cita.paciente?.nombre_completo,
        cita.doctor?.nombre_completo,
        cita.doctor?.especialidad,
        cita.motivo,
        cita.estado,
        cita.fecha,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [citasOrdenadas, query, statusFilter]);

  const citasHoy = citasOrdenadas.filter((cita) => cita.fecha === today);
  const citasPendientes = citasOrdenadas.filter(
    (cita) => cita.estado === "pendiente",
  );
  const pacientesActivos = pacientes.filter(
    (paciente) => paciente.activo !== false,
  );
  const doctoresActivos = doctores.filter((doctor) => doctor.activo !== false);

  const gruposPacientes = useMemo(() => {
    const groups = pacientesActivos.reduce((acc, paciente) => {
      const key = paciente.id_usuario || paciente.id_paciente;
      const current = acc.get(key) || [];
      current.push(paciente);
      acc.set(key, current);
      return acc;
    }, new Map());

    return [...groups.entries()]
      .map(([idUsuario, integrantes]) => {
        const ordenados = [...integrantes].sort((a, b) => {
          if (a.parentesco === "titular") return -1;
          if (b.parentesco === "titular") return 1;
          return a.nombre_completo.localeCompare(b.nombre_completo);
        });

        return {
          idUsuario,
          titular: ordenados[0],
          integrantes: ordenados,
          familiares: ordenados.slice(1),
        };
      })
      .sort((a, b) =>
        a.titular.nombre_completo.localeCompare(b.titular.nombre_completo),
      );
  }, [pacientesActivos]);

  const selectedPatientGroup = useMemo(() => {
    if (!form.id_paciente) return null;
    const pacienteSeleccionado = pacientesActivos.find(
      (paciente) => paciente.id_paciente === form.id_paciente,
    );
    if (!pacienteSeleccionado) return null;

    return gruposPacientes.find((grupo) =>
      grupo.integrantes.some(
        (paciente) => paciente.id_usuario === pacienteSeleccionado.id_usuario,
      ),
    );
  }, [form.id_paciente, gruposPacientes, pacientesActivos]);

  const viewTitle = {
    agenda: "Agenda General",
    nueva: "Nueva Cita",
    pacientes: "Pacientes",
  };

  const viewDescription = {
    agenda: "Consulta, cancela y reprograma citas de la clinica.",
    nueva: "Registra una cita para un paciente activo.",
    pacientes: "Revisa pacientes titulares y sus familiares registrados.",
  };

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      // Ventana recepcionista: estos endpoints son de la guia para admin/recepcion.
      const [citasData, pacientesData, doctoresData] = await Promise.all([
        getCitasClinica(),
        getPacientesClinica(),
        getDoctoresAdmin(),
      ]);
      setCitas(citasData);
      setPacientes(pacientesData);
      setDoctores(doctoresData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, []);

  useEffect(() => {
    async function loadAvailability() {
      if (!form.id_doctor || !form.fecha) {
        setHorarios([]);
        return;
      }

      setLoadingHorarios(true);
      setError("");

      try {
        // Contrato de disponibilidad: doctor + fecha en formato YYYY-MM-DD.
        const data = await getDisponibilidad(form.id_doctor, form.fecha);
        setHorarios(data.horarios_disponibles || []);
      } catch (err) {
        setHorarios([]);
        setError(err.message);
      } finally {
        setLoadingHorarios(false);
      }
    }

    loadAvailability();
  }, [form.id_doctor, form.fecha]);

  useEffect(() => {
    async function loadRescheduleAvailability() {
      if (!selectedCita?.doctor?.id_doctor || !rescheduleForm.fecha) {
        setHorariosReagenda([]);
        return;
      }

      setLoadingHorariosReagenda(true);
      setError("");

      try {
        const data = await getDisponibilidad(
          selectedCita.doctor.id_doctor,
          rescheduleForm.fecha,
        );
        setHorariosReagenda(data.horarios_disponibles || []);
      } catch (err) {
        setHorariosReagenda([]);
        setError(err.message);
      } finally {
        setLoadingHorariosReagenda(false);
      }
    }

    loadRescheduleAvailability();
  }, [selectedCita, rescheduleForm.fecha]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "id_doctor" || field === "fecha"
        ? { hora_inicio: "" }
        : {}),
    }));
  }

  function logout() {
    clearSession();
    navigate("/", { replace: true });
  }

  async function handleCreateCita(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      // Recepcion puede crear cita para cualquier paciente de la clinica.
      await createCita({
        ...form,
        hora_fin: addMinutes(form.hora_inicio, 30),
      });
      setNotice("Cita registrada correctamente.");
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(cita) {
    setError("");
    setNotice("");

    try {
      await cancelCita(cita.id_cita);
      setNotice("Cita cancelada correctamente.");
      setSelectedCita(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleComplete(cita) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await completeCita(cita.id_cita);
      setNotice("Cita marcada como completada correctamente.");
      setSelectedCitaDetalle(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openPacienteDetail(idPaciente) {
    setLoadingPaciente(true);
    setError("");
    setNotice("");

    try {
      const data = await getPacienteClinica(idPaciente);
      setSelectedPaciente(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPaciente(false);
    }
  }

  async function openCitaDetail(idCita) {
    setLoadingCita(true);
    setError("");
    setNotice("");

    try {
      const data = await getCitaClinica(idCita);
      setSelectedCitaDetalle(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCita(false);
    }
  }

  async function openDoctorDetail(idDoctor) {
    setLoadingDoctorDetail(true);
    setError("");
    setNotice("");

    try {
      const data = await getDoctorAdmin(idDoctor);
      setSelectedDoctorDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDoctorDetail(false);
    }
  }

  function openReschedule(cita) {
    setSelectedCita(cita);
    setRescheduleForm({
      fecha: cita.fecha >= today ? cita.fecha : today,
      hora_inicio: "",
    });
    setHorariosReagenda([]);
    setNotice("");
    setError("");
  }

  async function handleReschedule(event) {
    event.preventDefault();
    if (!selectedCita || !rescheduleForm.hora_inicio) {
      setError(
        "Selecciona una nueva fecha y un horario disponible para reagendar.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await rescheduleCita(selectedCita.id_cita, {
        fecha: rescheduleForm.fecha,
        hora_inicio: rescheduleForm.hora_inicio,
        hora_fin: addMinutes(rescheduleForm.hora_inicio, 30),
      });
      setNotice("Cita reagendada correctamente.");
      setSelectedCita(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`reception-page min-h-screen bg-gray-100 text-slate-900 ${sidebarOpen ? "sidebar-open" : ""}`}
    >
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
        <aside className="app-sidebar reception-sidebar sticky top-0 grid h-screen w-72 shrink-0 grid-rows-[1fr_auto] border-r border-slate-100 bg-white px-6 py-8">
          <div className="min-h-0">
            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold">Panel de recepcion</p>
              <p className="text-xs font-bold uppercase text-slate-400">
                {user?.rol || "recepcionista"}
              </p>
            </div>
            <nav className="space-y-3">
              <button
                type="button"
                onClick={() => setActiveView("agenda")}
                className={`reception-nav-item flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold ${
                  activeView === "agenda"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs text-white">
                  1
                </span>
                Agenda general
              </button>
              <button
                type="button"
                onClick={() => setActiveView("nueva")}
                className={`reception-nav-item flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold ${
                  activeView === "nueva"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs">
                  2
                </span>
                Nueva cita
              </button>
              <button
                type="button"
                onClick={() => setActiveView("pacientes")}
                className={`reception-nav-item flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold ${
                  activeView === "pacientes"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs">
                  3
                </span>
                Pacientes
              </button>
            </nav>
          </div>

          <button
            type="button"
            onClick={logout}
            className="reception-logout rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-800"
          >
            Cerrar sesion
          </button>
        </aside>

        <main className="reception-main flex-1 bg-gray-50">
          <header className="reception-header border-b border-slate-100 bg-white px-8 py-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="w-full text-center">
                <h2 className="text-3xl font-semibold leading-tight text-slate-800">
                  {viewTitle[activeView]}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {viewDescription[activeView]}
                </p>
              </div>
              {activeView === "agenda" && (
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar paciente, doctor o fecha..."
                  className="w-full max-w-sm rounded-full border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </header>

          <section className="px-8 py-8">
            {error && (
              <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {notice}
              </p>
            )}

            {activeView === "agenda" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <article className="reception-card rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold text-slate-500">
                      Citas hoy
                    </p>
                    <p className="mt-4 text-4xl font-semibold">
                      {citasHoy.length}
                    </p>
                  </article>
                  <article className="reception-card rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold text-slate-500">
                      Pendientes
                    </p>
                    <p className="mt-4 text-4xl font-semibold text-blue-700">
                      {citasPendientes.length}
                    </p>
                  </article>
                  <article className="reception-card rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold text-slate-500">
                      Pacientes activos
                    </p>
                    <p className="mt-4 text-4xl font-semibold">
                      {pacientesActivos.length}
                    </p>
                  </article>
                </div>

                <section className="reception-card rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold">Citas registradas</h3>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                        className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="todas">Todas</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="cancelada">Canceladas</option>
                        <option value="completada">Completadas</option>
                      </select>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                        {citasFiltradas.length} registros
                      </span>
                    </div>
                  </div>

                  {loading ? (
                    <p className="rounded-xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                      Cargando informacion de recepcion...
                    </p>
                  ) : citasFiltradas.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Paciente</th>
                            <th className="px-4 py-3">Doctor</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {citasFiltradas.map((cita) => (
                            <tr key={cita.id_cita} className="bg-white">
                              <td className="px-4 py-4">
                                <p className="font-semibold">
                                  {formatDate(cita.fecha)}
                                </p>
                                <p className="text-xs font-semibold text-slate-400">
                                  {timeText(cita.hora_inicio)} -{" "}
                                  {timeText(cita.hora_fin)}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-semibold">
                                  {cita.paciente?.nombre_completo}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {cita.motivo}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-bold">
                                  {cita.doctor?.nombre_completo}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {cita.doctor?.especialidad}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClass(cita.estado)}`}
                                >
                                  {cita.estado}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-2">
                                  {cita.estado === "pendiente" && (
                                    <button
                                      type="button"
                                      onClick={() => handleComplete(cita)}
                                      disabled={saving}
                                      className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:text-slate-400"
                                    >
                                      Completar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openCitaDetail(cita.id_cita)}
  disabled={loadingCita}
  className="rounded-lg bg-[#71ADBD] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] disabled:bg-slate-300"
>
  Ver detalle
</button>
                                  <button
                                    type="button"
                                    onClick={() => openReschedule(cita)}
                                    disabled={cita.estado === "cancelada"}
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                                  >
                                    Reagendar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(cita)}
                                    disabled={cita.estado === "cancelada"}
                                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:bg-slate-50 disabled:text-slate-300"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                      <p className="font-semibold">
                        No hay citas para mostrar.
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Cambia la busqueda o registra una cita nueva.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeView === "nueva" && (
              <form
                onSubmit={handleCreateCita}
                className="reception-card mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"
              >
                <div className="mb-7">
                  <h3 className="text-2xl font-semibold">Registrar cita</h3>
                  <p className="text-sm font-semibold text-slate-500">
                    Selecciona paciente, doctor, fecha disponible y motivo de
                    consulta.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      Paciente
                    </label>
                    <select
                      value={form.id_paciente}
                      onChange={(event) =>
                        updateForm("id_paciente", event.target.value)
                      }
                      className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar paciente</option>
                      {pacientesActivos.map((paciente) => (
                        <option
                          key={paciente.id_paciente}
                          value={paciente.id_paciente}
                        >
                          {paciente.nombre_completo} - {paciente.curp}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPatientGroup &&
                    selectedPatientGroup.integrantes.length > 1 && (
                      <div className="rounded-xl bg-blue-50 p-4 md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-blue-700">
                          Familiares registrados
                        </p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {selectedPatientGroup.integrantes.map((paciente) => (
                            <button
                              type="button"
                              key={paciente.id_paciente}
                              onClick={() =>
                                updateForm("id_paciente", paciente.id_paciente)
                              }
                              className={`flex items-center justify-between rounded-lg px-3 py-3 text-left text-xs font-bold ${
                                form.id_paciente === paciente.id_paciente
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-slate-600"
                              }`}
                            >
                              <span>{paciente.nombre_completo}</span>
                              <span className="uppercase">
                                {paciente.parentesco}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      Doctor
                    </label>
                    <select
                      value={form.id_doctor}
                      onChange={(event) =>
                        updateForm("id_doctor", event.target.value)
                      }
                      className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar doctor</option>
                      {doctoresActivos.map((doctor) => (
                        <option key={doctor.id_doctor} value={doctor.id_doctor}>
                          {doctor.nombre_completo} - {doctor.especialidad}
                        </option>
                      ))}
                    </select>
                    {form.id_doctor && (
                      <button
                        type="button"
                        onClick={() => openDoctorDetail(form.id_doctor)}
                        disabled={loadingDoctorDetail}
                        className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:text-slate-400"
                      >
                        Ver ficha del doctor
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      Fecha
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={form.fecha}
                      onChange={(event) =>
                        updateForm("fecha", event.target.value)
                      }
                      className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      Horario
                    </label>
                    <select
                      value={form.hora_inicio}
                      onChange={(event) =>
                        updateForm("hora_inicio", event.target.value)
                      }
                      className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">
                        {loadingHorarios
                          ? "Consultando..."
                          : "Seleccionar horario"}
                      </option>
                      {horarios.map((horario) => (
                        <option
                          key={`${horario.hora_inicio}-${horario.hora_fin}`}
                          value={horario.hora_inicio}
                        >
                          {horario.hora_inicio} - {horario.hora_fin}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      Motivo
                    </label>
                    <textarea
                      value={form.motivo}
                      onChange={(event) =>
                        updateForm("motivo", event.target.value)
                      }
                      rows="5"
                      placeholder="Motivo de consulta..."
                      className="w-full resize-none rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-7 w-full rounded-xl bg-blue-700 py-4 font-semibold text-white shadow-lg hover:bg-blue-800 disabled:bg-blue-300"
                >
                  {saving ? "Guardando..." : "Guardar cita"}
                </button>
              </form>
            )}

            {activeView === "pacientes" && (
              <section className="reception-card mx-auto max-w-4xl rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold">Pacientes</h3>
                    <p className="text-sm font-semibold text-slate-500">
                      Da click en un titular para ver familiares y parentesco.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                    {gruposPacientes.length} cuentas
                  </span>
                </div>

                <div className="space-y-4">
                  {gruposPacientes.map((grupo) => (
                    <article
                      key={grupo.idUsuario}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPatientGroup((current) =>
                            current === grupo.idUsuario ? "" : grupo.idUsuario,
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <div>
                          <p className="text-lg font-semibold">
                            {grupo.titular.nombre_completo}
                          </p>
                          <p className="text-sm font-semibold text-slate-500">
                            Paciente titular - {grupo.titular.curp}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-blue-700">
                          {grupo.integrantes.length} paciente
                          {grupo.integrantes.length === 1 ? "" : "s"}
                        </span>
                      </button>

                      {expandedPatientGroup === grupo.idUsuario && (
                        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                          {grupo.integrantes.map((paciente) => (
                            <article
                              key={paciente.id_paciente}
                              className="rounded-lg bg-white px-4 py-3 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {paciente.nombre_completo}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-500">
                                    {paciente.curp}
                                  </p>
                                </div>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                                  {paciente.parentesco || "sin dato"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPacienteDetail(paciente.id_paciente)
                                  }
                                  disabled={loadingPaciente}
                                  className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:text-slate-400"
                                >
                                  Ver ficha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateForm(
                                      "id_paciente",
                                      paciente.id_paciente,
                                    );
                                    setActiveView("nueva");
                                  }}
                                  className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                                >
                                  Agendar cita
                                </button>
                              </div>
                            </article>
                          ))}

                          {grupo.familiares.length === 0 && (
                            <p className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-500 md:col-span-2">
                              No tiene familiares registrados en esta cuenta.
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        </main>
      </div>

      {selectedCita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <form
            onSubmit={handleReschedule}
            className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-semibold">Reagendar cita</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {selectedCita.paciente?.nombre_completo} con{" "}
              {selectedCita.doctor?.nombre_completo}
            </p>

            <label className="mt-6 mb-2 block text-sm font-bold text-slate-600">
              Nueva fecha
            </label>
            <input
              type="date"
              min={today}
              value={rescheduleForm.fecha}
              onChange={(event) =>
                setRescheduleForm({
                  fecha: event.target.value,
                  hora_inicio: "",
                })
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            <label className="mt-5 mb-2 block text-sm font-bold text-slate-600">
              Nuevo horario
            </label>
            <select
              value={rescheduleForm.hora_inicio}
              onChange={(event) =>
                setRescheduleForm((current) => ({
                  ...current,
                  hora_inicio: event.target.value,
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">
                {loadingHorariosReagenda
                  ? "Consultando..."
                  : "Seleccionar horario"}
              </option>
              {horariosReagenda.map((horario) => (
                <option
                  key={`${horario.hora_inicio}-${horario.hora_fin}`}
                  value={horario.hora_inicio}
                >
                  {horario.hora_inicio} - {horario.hora_fin}
                </option>
              ))}
            </select>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedCita(null)}
                className="rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
              >
                {saving ? "Guardando..." : "Guardar cambio"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedPaciente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">
                  Ficha de paciente
                </p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {selectedPaciente.nombre_completo}
                </h3>
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
                <p className="text-xs font-bold uppercase text-slate-500">
                  Nombre
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.nombre || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Apellido
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.apellido || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Sexo
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.sexo || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Fecha de nacimiento
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.fecha_nacimiento || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  CURP
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.curp || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Parentesco
                </p>
                <p className="mt-1 font-semibold">
                  {selectedPaciente.parentesco || "Sin dato"}
                </p>
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

      {selectedCitaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">
                  Detalle de cita
                </p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {selectedCitaDetalle.paciente?.nombre_completo ||
                    "Paciente sin dato"}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  ID: {selectedCitaDetalle.id_cita}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase text-blue-700">
                {selectedCitaDetalle.estado || "sin estado"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Paciente
                </p>
                <p className="mt-1 font-semibold">
                  {selectedCitaDetalle.paciente?.nombre_completo || "Sin dato"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Doctor
                </p>
                <p className="mt-1 font-semibold">
                  {selectedCitaDetalle.doctor?.nombre_completo || "Sin dato"}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedCitaDetalle.doctor?.especialidad ||
                    "Sin especialidad"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Fecha
                </p>
                <p className="mt-1 font-semibold">
                  {formatDate(selectedCitaDetalle.fecha)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Horario
                </p>
                <p className="mt-1 font-semibold">
                  {timeText(selectedCitaDetalle.hora_inicio) || "Sin hora"} -{" "}
                  {timeText(selectedCitaDetalle.hora_fin) || "Sin hora"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Motivo
                </p>
                <p className="mt-1 font-semibold">
                  {selectedCitaDetalle.motivo || "Sin motivo registrado"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {selectedCitaDetalle.estado === "pendiente" && (
                <button
                  type="button"
                  onClick={() => handleComplete(selectedCitaDetalle)}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                >
                  Completar cita
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCitaDetalle(null)}
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
                <p className="text-xs font-bold uppercase text-blue-700">
                  Ficha de doctor
                </p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {selectedDoctorDetail.nombre_completo}
                </h3>
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
                <p className="text-xs font-bold uppercase text-slate-500">
                  Especialidad
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.especialidad || "Sin especialidad"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Precio de consulta
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.precio_consulta
                    ? `$${Number(selectedDoctorDetail.precio_consulta).toFixed(2)}`
                    : "Sin precio"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Correo
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.correo || "Sin correo"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Telefono
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.telefono || "Sin telefono"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  CURP
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.curp || "Sin CURP"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Fecha de baja
                </p>
                <p className="mt-1 font-semibold">
                  {selectedDoctorDetail.fecha_baja || "Sin baja"}
                </p>
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
  );
}
