# Front Citas Medicas

Frontend del sistema de citas medicas desarrollado con React y Vite.

Este proyecto se conecta con el backend de `hospital_backend` para manejar inicio de sesion, registro de pacientes, creacion de citas, historial de citas y vista del doctor.

## Requisitos

- Node.js instalado
- npm instalado
- Backend corriendo en `http://127.0.0.1:8010`
- Base de datos cargada en MySQL

## Instalacion

Primero instala las dependencias:

```bash
npm install
```

## Ejecutar en desarrollo

Para correr el frontend:

```bash
npm run dev
```

Despues abre la URL que muestre la terminal, normalmente:

```text
http://localhost:3000/
```

## Scripts disponibles

```bash
npm run dev
```

Inicia el proyecto en modo desarrollo.

```bash
npm run build
```

Genera la version final para produccion.

```bash
npm run lint
```

Revisa errores de estilo o problemas en el codigo.

```bash
npm run preview
```

Permite revisar la version generada por el build.

## Integracion con backend

La conexion con el backend esta centralizada en:

```text
src/services/api.js
```

Desde ese archivo se hacen las peticiones a los endpoints del backend. Tambien se guarda el token JWT del usuario despues del inicio de sesion para poder entrar a las pantallas protegidas.

## Pantallas principales

- Login de usuario
- Registro de paciente
- Solicitud de cita
- Historial de citas
- Confirmacion de cita
- Panel del doctor
- Detalle de cita del doctor
- Reagendar cita por emergencia

## Cuentas de prueba

Si la base de datos tiene los inserts actualizados, se pueden usar estas cuentas:

```text
Paciente:
juan@gmail.com
123456

Doctor:
doctor1@sanrafael.com
123456
```

## Nota

El frontend no crea endpoints nuevos. Solo consume los endpoints definidos por el backend y por la guia del proyecto.
