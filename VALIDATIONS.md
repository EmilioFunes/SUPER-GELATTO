# 📋 Informe Técnico de Validaciones - Super Gelatto
**Proyecto:** Tecnología en Análisis y Desarrollo de Software (SENA)
**Fase:** Planeación / Ejecución

Este documento detalla la implementación de las reglas de validación en el proyecto **Super Gelatto**, siguiendo los principios fundamentales de validación de datos (Cliente, Servidor y Base de Datos).

---

## 1. Validación en el Cliente (Frontend)
El objetivo es proporcionar retroalimentación inmediata y mejorar la experiencia del usuario (UX).

| Campo | Tipo de Validación | Regla / Patrón (Regex) | Acción en Error |
| :--- | :--- | :--- | :--- |
| **Nombre** | Presencia / Espacios | `required`, `value === value.trim()` | Mensaje: "Sin espacios al inicio/final" |
| **Email** | Formato / Espacios | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | Mensaje: "Email inválido o con espacios" |
| **Contraseña** | Complejidad | 8+ chars, Mayús, Minús, Núm, Esp, Sin Espacios | Mensaje: Detalle del requisito faltante |
| **Confirmar** | Comparación | `value === password` | Mensaje: "No coincide" |

**Mejoras de UX implementadas:**
- **Feedback en tiempo real**: Los errores aparecen mientras el usuario escribe (`onChange`).
- **Botón adaptativo**: El botón de envío se deshabilita si el formulario es inválido.
- **HTML5 Nativo**: Uso de atributos `required` y `type` para validación básica del navegador.

---

## 2. Validación en el Servidor (Backend)
Es la fuente de verdad y garantiza que ningún dato malintencionado sea procesado.

### 🔐 Seguridad y Sanitización
- **Sanitización XSS**: Se limpian los caracteres `<` y `>` de las entradas de texto para evitar inyección de scripts.
- **Sentencias Preparadas**: Uso de Supabase Client para evitar Inyección SQL.

### ⚙️ Validaciones de API
- **Registro**: Se repiten todas las validaciones del cliente para evitar bypass de JavaScript.
- **Pedidos (Venta)**:
    - **Validación de Tipos**: Verifica que el `total` sea numérico.
    - **Lógica de Negocio**: El `total` debe ser estrictamente mayor a 0.
    - **Integridad**: El array de productos no puede estar vacío.

---

## 3. Validación en la Base de Datos (Última Línea de Defensa)
Garantiza la integridad referencial y las restricciones a nivel de esquema en Supabase.

| Tabla | Restricción | Propósito |
| :--- | :--- | :--- |
| `usuario` | **PK** (`id_usuario`) | Identificación única del cliente. |
| `usuario` | **UNIQUE** (`email`) | Evita cuentas duplicadas con el mismo correo. |
| `venta` | **FK** (`id_usuario`) | Asegura que toda venta pertenezca a un usuario real. |
| `venta` | **CHECK** (`total >= 0`) | Regla de negocio: No se permiten ventas con totales negativos. |
| `producto`| **CHECK** (`precio >= 0`) | Regla de negocio: El precio base debe ser válido. |
| `inventario`| **CHECK** (`stock >= 0`) | Evita niveles de stock inconsistentes. |

---

## 🛠️ Tecnologías de Validación Utilizadas
- **Frontend**: React (Hooks de estado para errores), CSS3 (Animaciones y feedback visual).
- **Backend**: Node.js, Express, JavaScript (Lógica de tipos y sanitización).
- **Base de Datos**: PostgreSQL (Supabase) con Constraints y Checks.

---
**Desarrollado para:** Proyecto Formativo SENA - Super Gelatto 🍦
