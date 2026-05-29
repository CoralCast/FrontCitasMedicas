const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://100.73.30.52:8001"

// El backend corre en la ip de arriba
// se guardan el token JWT y los datos del usuario despues del login
const TOKEN_KEY = "citas_access_token"
const USER_KEY = "citas_user"

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY)
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function saveSession(authData, userData = null) {
  //  el backend responde access_token
  // frontend lo guarda para mandarlo despues en Authorization
  localStorage.setItem(TOKEN_KEY, authData.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(userData || authData))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options
  const token = getToken()
  const headers = new Headers(fetchOptions.headers)

  //cuando se manda JSON, usar Content-Type: application/json.
  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  // todos los endpoints protegidos usan Authorization
  if (token && !skipAuth) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  })

  let data = null
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    data = await response.json()
  }

  if (!response.ok) {
    const message = data?.detail || "No se pudo completar la solicitud"
    // si el token ya no sirve, se limpia la sesion para volver al login
    if (response.status === 401) {
      clearSession()
    }
    throw new Error(Array.isArray(message) ? message.map((item) => item.msg).join(", ") : message)
  }

  return data
}

export async function login(correo, password) {
  //  POST /auth/login recibe { correo, password }.
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ correo, password }),
  })
}

export async function registerClient(datos) {
  // POST /auth/register es publico y recibe id_clinica_tenant,
  // correo, telefono, password y datos del paciente titular
  return request("/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(datos),
  })
}

export function getMe() {
  //  GET /auth/me regresa el usuario autenticado.
  return request("/auth/me")
}

export function getClinicasPublicas() {
  // GET /clinicas/publicas no requiere token.
  // se usa antes del registro para elegir clinica.
  return request("/clinicas/publicas", { skipAuth: true })
}

export function getPacientes() {
  // contrato de la guia: GET /pacientes/me lista pacientes del usuario logueado.
  return request("/pacientes/me")
}

export function getPacientesClinica() {
  // GET /pacientes es para admin/recepcionista.
  return request("/pacientes")
}

export function getPacienteClinica(idPaciente) {
  // Guia front 2: GET /pacientes/{id_paciente} detalle admin/recepcion.
  return request(`/pacientes/${idPaciente}`)
}

export function createPaciente(paciente) {
  // Contrato de la guia: POST /pacientes recibe nombre, apellido, sexo,
  // fecha_nacimiento, curp y parentesco. No se manda id_usuario ni clinica.
  return request("/pacientes", {
    method: "POST",
    body: JSON.stringify(paciente),
  })
}

export function updatePaciente(idPaciente, paciente) {
  return request(`/pacientes/${idPaciente}`, {
    method: "PATCH",
    body: JSON.stringify(paciente),
  })
}

export function updatePacienteEstado(idPaciente, activo) {
  return request(`/pacientes/${idPaciente}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  })
}

export function getEspecialidades() {
  return request("/catalogos/especialidades")
}

export function getParentescos() {
  // GET /catalogos/parentescos alimenta el dropdown.
  return request("/catalogos/parentescos")
}

export function getEstadosCita() {
  return request("/catalogos/estados-cita")
}

export function getDoctores() {
  // GET /catalogos/doctores alimenta doctores, especialidad y precio.
  return request("/catalogos/doctores")
}

export function getDoctoresAdmin() {
  // GET /doctores es informacion completa para admin/recepcion.
  return request("/doctores")
}

export function getDoctorAdmin(idDoctor) {
  return request(`/doctores/${idDoctor}`)
}

export function createDoctor(doctor) {
  //  POST /doctores solo admin. Crea usuario doctor, perfil y precio
  return request("/doctores", {
    method: "POST",
    body: JSON.stringify(doctor),
  })
}

export function updateDoctor(idDoctor, doctor) {
  //  PATCH /doctores/{id_doctor} edita datos basicos y precio
  return request(`/doctores/${idDoctor}`, {
    method: "PATCH",
    body: JSON.stringify(doctor),
  })
}

export function updateDoctorEstado(idDoctor, activo) {
  //  PATCH /doctores/{id_doctor}/estado activa/desactiva doctor
  return request(`/doctores/${idDoctor}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  })
}

export function getHorariosDoctor(idDoctor) {
  // admin/recepcion/doctor pueden consultar horarios
  return request(`/doctores/${idDoctor}/horarios`)
}

export function createHorarioDoctor(idDoctor, horario) {
  return request(`/doctores/${idDoctor}/horarios`, {
    method: "POST",
    body: JSON.stringify(horario),
  })
}

export function updateHorarioDoctor(idHorario, horario) {
  return request(`/doctores/horarios/${idHorario}`, {
    method: "PATCH",
    body: JSON.stringify(horario),
  })
}

export function deleteHorarioDoctor(idHorario) {
  return request(`/doctores/horarios/${idHorario}`, {
    method: "DELETE",
  })
}

export function getBloqueosDoctor(idDoctor) {
  // bloqueos son ausencias, vacaciones o emergencias de agenda
  return request(`/doctores/${idDoctor}/bloqueos`)
}

export function createBloqueoDoctor(idDoctor, bloqueo) {
  return request(`/doctores/${idDoctor}/bloqueos`, {
    method: "POST",
    body: JSON.stringify(bloqueo),
  })
}

export function updateBloqueoDoctor(idBloqueo, bloqueo) {
  return request(`/doctores/bloqueos/${idBloqueo}`, {
    method: "PATCH",
    body: JSON.stringify(bloqueo),
  })
}

export function deleteBloqueoDoctor(idBloqueo) {
  return request(`/doctores/bloqueos/${idBloqueo}`, {
    method: "DELETE",
  })
}

export function getDisponibilidad(idDoctor, fecha) {
  //consultar disponibilidad por doctor y fecha YYYY-MM-DD.
  return request(`/doctores/${idDoctor}/disponibilidad?fecha=${fecha}`)
}

export function getCitas() {
  //GET /citas/me regresa citas segun rol del usuario.
  return request("/citas/me")
}

export function getCitasClinica() {
  //  GET /citas es agenda general para admin/recepcionista.
  return request("/citas")
}

export function getCitaClinica(idCita) {
  return request(`/citas/${idCita}`)
}

export function createCita(cita) {
  //POST /citas recibe id_paciente,
  // id_doctor, fecha, hora_inicio y motivo
  return request("/citas", {
    method: "POST",
    body: JSON.stringify(cita),
  })
}

export function cancelCita(idCita) {
  // Contrato de la guia: cancelar cita no requiere body.
  return request(`/citas/${idCita}/cancelar`, {
    method: "PATCH",
  })
}

export function completeCita(idCita) {
  return request(`/citas/${idCita}/completar`, {
    method: "PATCH",
  })
}

export function rescheduleCita(idCita, datos) {
  // Contrato de la guia para cliente: reprogramar recibe fecha y hora_inicio.
  // No mandamos hora_fin porque el backend calcula 30 minutos.
  return request(`/citas/${idCita}/reprogramar`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  })
}
