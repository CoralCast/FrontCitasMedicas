import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FiEye, FiEyeOff } from "react-icons/fi"

import {
  getClinicasPublicas,
  getMe,
  registerClient,
  saveSession,
} from "../services/api"

const initialForm = {
  id_clinica_tenant: "",
  nombre: "",
  apellido: "",
  sexo: "femenino",
  fecha_nacimiento: "",
  curp: "",
  telefono: "",
  correo: "",
  password: "",
  confirmPassword: "",
}

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [clinicas, setClinicas] = useState([])
  const [loadingClinicas, setLoadingClinicas] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const canShowRegistrationFields = Boolean(
    !loadingClinicas && clinicas.length > 0 && form.id_clinica_tenant,
  )

  useEffect(() => {
    async function loadClinicas() {
      setLoadingClinicas(true)
      setError("")

      try {
        const data = await getClinicasPublicas()

        setClinicas(data)

        setForm((current) => ({
          ...current,
          id_clinica_tenant:
            current.id_clinica_tenant ||
            data[0]?.id_clinica_tenant ||
            "",
        }))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingClinicas(false)
      }
    }

    queueMicrotask(loadClinicas)
  }, [])

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")

    if (!form.id_clinica_tenant) {
      setError("Selecciona una clinica para continuar.")
      return
    }

    if (form.password !== form.confirmPassword) {
      setError("Las contrasenas no coinciden.")
      return
    }

    setSaving(true)

    try {
      const authData = await registerClient({
        id_clinica_tenant: form.id_clinica_tenant,
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        password: form.password,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        sexo: form.sexo,
        fecha_nacimiento: form.fecha_nacimiento,
        curp: form.curp.trim().toUpperCase(),
      })

      saveSession(authData)

      const userData = await getMe()

      saveSession(authData, userData)

      navigate("/cita", { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="auth-screen min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div
        className={`auth-card register-card w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-[0.78fr_1.22fr] ${
          canShowRegistrationFields ? "" : "register-card-empty"
        }`}
      >

        <div className="auth-visual hidden md:flex flex-col justify-between bg-blue-700 p-8 text-white">
          <div />
        </div>

        <form onSubmit={handleSubmit} className="auth-form p-6 md:p-8">

          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Crear Cuenta
          </h1>

          <p className="text-center text-gray-500 mb-6">
            Selecciona una clinica y registra al paciente titular.
          </p>

          {error && (
            <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              Clinica
            </label>

            <select
              value={form.id_clinica_tenant}
              onChange={(event) =>
                updateForm("id_clinica_tenant", event.target.value)
              }
              disabled={loadingClinicas}
              required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {loadingClinicas
                  ? "Cargando clinicas..."
                  : "Selecciona una clinica"}
              </option>

              {clinicas.map((clinica) => (
                <option
                  key={clinica.id_clinica_tenant}
                  value={clinica.id_clinica_tenant}
                >
                  {clinica.nombre}
                </option>
              ))}
            </select>
          </div>

          {canShowRegistrationFields ? (
            <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Nombre
              </label>

              <input
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  updateForm("nombre", event.target.value)
                }
                placeholder="Ej. Ana"
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Apellido
              </label>

              <input
                type="text"
                value={form.apellido}
                onChange={(event) =>
                  updateForm("apellido", event.target.value)
                }
                placeholder="Ej. Garcia Lopez"
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Fecha de nacimiento
              </label>

              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(event) =>
                  updateForm("fecha_nacimiento", event.target.value)
                }
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Sexo
              </label>

              <select
                value={form.sexo}
                onChange={(event) =>
                  updateForm("sexo", event.target.value)
                }
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                CURP
              </label>

              <input
                type="text"
                value={form.curp}
                onChange={(event) =>
                  updateForm("curp", event.target.value)
                }
                placeholder="18 caracteres"
                minLength={18}
                maxLength={18}
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Telefono
              </label>

              <input
                type="tel"
                value={form.telefono}
                onChange={(event) =>
                  updateForm("telefono", event.target.value)
                }
                placeholder="6461000099"
                minLength={7}
                maxLength={20}
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Correo electronico
              </label>

              <input
                type="email"
                value={form.correo}
                onChange={(event) =>
                  updateForm("correo", event.target.value)
                }
                placeholder="nombre@ejemplo.com"
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Contrasena
              </label>

              <div className="relative">

                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                  placeholder="Minimo 6 caracteres"
                  minLength={6}
                  maxLength={72}
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600"
                >
                  {showPassword ? (
                    <FiEyeOff size={20} />
                  ) : (
                    <FiEye size={20} />
                  )}
                </button>

              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Confirmar
              </label>

              <div className="relative">

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateForm("confirmPassword", event.target.value)
                  }
                  placeholder="Repite tu contrasena"
                  required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600"
                >
                  {showConfirmPassword ? (
                    <FiEyeOff size={20} />
                  ) : (
                    <FiEye size={20} />
                  )}
                </button>

              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={saving || !canShowRegistrationFields}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-all text-white py-4 rounded-xl font-semibold shadow-lg"
          >
            {saving ? "Creando cuenta..." : "Crear cuenta"}
          </button>
            </>
          ) : (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center text-sm font-semibold text-blue-700">
              {loadingClinicas
                ? "Cargando clinicas disponibles..."
                : "No hay clinicas disponibles para completar el registro."}
            </div>
          )}

          <p className="text-center text-gray-500 mt-8">
            Ya tienes una cuenta?{" "}

            <Link to="/" className="text-blue-600 font-semibold">
              Iniciar sesion
            </Link>
          </p>

        </form>
      </div>
    </div>
  )
}
