import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FiEye, FiEyeOff } from "react-icons/fi"
import { getMe, login, saveSession } from "../services/api"

export default function Login() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const authData = await login(correo, password)
      saveSession(authData)

      const userData = await getMe()
      saveSession(authData, userData)

      if (userData.rol === "doctor") {
        navigate("/doctor", { replace: true })
      } else if (userData.rol === "admin") {
        navigate("/admin", { replace: true })
      } else if (userData.rol === "recepcionista") {
        navigate("/recepcion", { replace: true })
      } else {
        navigate("/cita", { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="auth-card w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="auth-visual bg-blue-700 flex items-center justify-center p-10">
          <div className="auth-visual-card w-full h-full rounded-2xl bg-white/10 p-8 text-white" />
        </div>

        <form onSubmit={handleSubmit} className="auth-form p-10 flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">
            Bienvenido
          </h1>

          <p className="text-center text-gray-500 mb-8">
            Ingresa tus datos para continuar
          </p>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              CORREO ELECTRONICO
            </label>

            <input
              type="email"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              placeholder="nombre@ejemplo.com"
              required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              CONTRASENA
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
                className="w-full bg-gray-100 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="my-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-all text-white py-4 rounded-xl font-semibold shadow-lg mt-6"
          >
            {loading ? "Iniciando..." : "Iniciar sesion"}
          </button>

          <p className="text-center text-gray-500 mt-8">
            No tienes una cuenta todavia?{" "}
            <Link to="/register" className="text-blue-600 font-semibold">
              Crear una cuenta nueva
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}