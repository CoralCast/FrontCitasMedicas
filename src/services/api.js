const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8010"

// Guia frontend: el backend local corre en http://127.0.0.1:8010.
// Aqui se guardan el token JWT y los datos del usuario despues del login.
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
  // Contrato /auth/login: el backend responde access_token.
  // El frontend lo guarda para mandarlo despues en Authorization.
  localStorage.setItem(TOKEN_KEY, authData.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(userData || authData))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function normalizeText(value) {
  return String(value || "")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã±", "ñ")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã", "Í")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .replaceAll("Ã‘", "Ñ")
}

function friendlyErrorMessage(message, status) {
  const normalized = normalizeText(Array.isArray(message) ? message.map((item) => item.msg).join(", ") : message)
  const text = normalized.toLowerCase()

  if (status === 401) return "Tu sesión expiró. Inicia sesión nuevamente."
  if (status === 403) return "No tienes permisos para realizar esta acción."
  if (status === 404) return "No se encontró la información solicitada."
  if (status === 429) return "Se hicieron demasiados intentos. Espera un momento e intenta de nuevo."

  if (text.includes("correo") && text.includes("contraseña")) {
    return "Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo."
  }
  if (text.includes("contraseñas no coinciden")) return "Las contraseñas no coinciden."
  if (text.includes("ya existe") && text.includes("correo")) return "Ya existe una cuenta con este correo."
  if (text.includes("ya existe") && text.includes("teléfono")) return "Ya existe una cuenta con este teléfono."
  if (text.includes("ya existe") && text.includes("curp")) return "Ya existe un paciente registrado con esa CURP."
  if (text.includes("clínica no válida") || text.includes("clinica no valida")) {
    return "La clínica seleccionada no está disponible. Elige otra clínica."
  }
  if (text.includes("cita ya está cancelada") || text.includes("cita ya esta cancelada")) {
    return "Esta cita ya está cancelada."
  }
  if (text.includes("al menos 24 horas")) {
    return "Solo puedes cancelar citas con al menos 24 horas de anticipación."
  }
  if (text.includes("no pertenecen") || text.includes("propias citas")) {
    return "No tienes permisos para modificar esta cita."
  }
  if (text.includes("horario bloqueado")) return "Este horario está bloqueado. Elige otro horario."
  if (text.includes("conflicto con otra cita")) return "Ese horario ya no está disponible. Elige otro horario."
  if (text.includes("fuera del horario")) return "El horario seleccionado está fuera de la agenda del doctor."
  if (text.includes("doctor está inactivo") || text.includes("doctor esta inactivo")) {
    return "El doctor está inactivo, no se pueden crear citas con este doctor."
  }
  if (text.includes("no se puede reprogramar una cita cancelada")) {
    return "No puedes reagendar una cita cancelada."
  }
  if (text.includes("no se puede completar una cita cancelada")) {
    return "No puedes completar una cita cancelada."
  }
  if (text.includes("solo puedes completar tus propias citas")) {
    return "Solo puedes completar tus propias citas."
  }
  if (text.includes("estado completada")) {
    return "No se encontro el estado completada en la base de datos."
  }

  return normalized || "No se pudo completar la acción. Verifica la información e intenta de nuevo."
}

async function request(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options
  const token = getToken()
  const headers = new Headers(fetchOptions.headers)

  // Guia frontend: cuando se manda JSON, usar Content-Type: application/json.
  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  // Guia frontend: todos los endpoints protegidos usan Authorization: Bearer TOKEN.
  if (token && !skipAuth) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica que el sistema esté activo.")
  }

  let data = null
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    data = await response.json()
  }

  if (!response.ok) {
    const message = data?.detail || "No se pudo completar la solicitud"
    // Si el token ya no sirve, se limpia la sesion para volver al login.
    if (response.status === 401) {
      clearSession()
    }
    throw new Error(friendlyErrorMessage(message, response.status))
  }

  return data
}

export async function login(correo, password) {
  // Contrato de la guia: POST /auth/login recibe { correo, password }.
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ correo, password }),
  })
}

export async function registerClient(datos) {
  // Guia front 2: POST /auth/register es publico y recibe id_clinica_tenant,
  // correo, telefono, password y datos del paciente titular.
  return request("/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(datos),
  })
}

export function getMe() {
  // Contrato de la guia: GET /auth/me regresa el usuario autenticado.
  return request("/auth/me")
}

export function getClinicasPublicas() {
  // Guia front 2: GET /clinicas/publicas no requiere token.
  // Se usa antes del registro para elegir clinica.
  return request("/clinicas/publicas", { skipAuth: true })
}

export function getPacientes() {
  // Contrato de la guia: GET /pacientes/me lista pacientes del usuario logueado.
  return request("/pacientes/me")
}

export function getPacientesClinica() {
  // Guia front 2: GET /pacientes es para admin/recepcionista.
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
  // Contrato de la guia: GET /catalogos/parentescos alimenta el dropdown.
  return request("/catalogos/parentescos")
}

export function getEstadosCita() {
  return request("/catalogos/estados-cita")
}

export function getDoctores() {
  // Contrato de la guia: GET /catalogos/doctores alimenta doctores, especialidad y precio.
  return request("/catalogos/doctores")
}

export function getDoctoresAdmin() {
  // Guia front 2: GET /doctores es informacion completa para admin/recepcion.
  return request("/doctores")
}

export function getDoctorAdmin(idDoctor) {
  return request(`/doctores/${idDoctor}`)
}

export function createDoctor(doctor) {
  // Guia front 2: POST /doctores solo admin. Crea usuario doctor, perfil y precio.
  return request("/doctores", {
    method: "POST",
    body: JSON.stringify(doctor),
  })
}

export function updateDoctor(idDoctor, doctor) {
  // Guia front 2: PATCH /doctores/{id_doctor} edita datos basicos y precio.
  return request(`/doctores/${idDoctor}`, {
    method: "PATCH",
    body: JSON.stringify(doctor),
  })
}

export function updateDoctorEstado(idDoctor, activo) {
  // Guia front 2: PATCH /doctores/{id_doctor}/estado activa/desactiva doctor.
  return request(`/doctores/${idDoctor}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  })
}

export function getHorariosDoctor(idDoctor) {
  // Guia front 2: admin/recepcion/doctor pueden consultar horarios.
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
  // Guia front 2: bloqueos son ausencias, vacaciones o emergencias de agenda.
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
  // Contrato de la guia: consultar disponibilidad por doctor y fecha YYYY-MM-DD.
  return request(`/doctores/${idDoctor}/disponibilidad?fecha=${fecha}`)
}

export function getCitas() {
  // Contrato de la guia: GET /citas/me regresa citas segun rol del usuario.
  return request("/citas/me")
}

export function getCitasClinica() {
  // Guia front 2: GET /citas es agenda general para admin/recepcionista.
  return request("/citas")
}

export function getCitaClinica(idCita) {
  return request(`/citas/${idCita}`)
}

export function createCita(cita) {
  // Contrato de la guia para cliente: POST /citas recibe id_paciente,
  // id_doctor, fecha, hora_inicio y motivo. No mandamos hora_fin.
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
  // Backend nuevo: doctores, recepcionistas y admins pueden marcar cita completada.
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
