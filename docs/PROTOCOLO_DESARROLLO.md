# 📜 Protocolo de Desarrollo y Sincronización Multiplataforma

Este documento es una guía obligatoria para cualquier IA o desarrollador que trabaje en este proyecto. Su objetivo es mantener la armonía entre la **Web**, la app **Android** y el **Backend**.

---

## 🔄 Flujo de Trabajo "Tiered" (Obligatorio)

Para implementar cualquier nueva idea o cambio, el flujo DEBE seguir este orden:

### 1. Backend Primero (El Cimiento)
*   **Acción:** Crear o modificar los Endpoints en FastAPI (`backend/main.py`).
*   **Por qué:** Centraliza la lógica. Si el cálculo cambia, cambia para ambas apps a la vez.
*   **Validación:** Probar los JSON en `/docs` del backend antes de programar la interfaz.

### 2. Implementación Web (El Laboratorio)
*   **Acción:** Implementar la idea en la aplicación Web Frontend.
*   **Por qué:** Es el entorno más rápido para iterar diseño, lógica y manejo de estados. Sirve como "plano" para la versión móvil.

### 3. Adaptación Android (La Entrega)
*   **Acción:** Adaptar la lógica y diseño validado en Web a **React Native (Expo)**.
*   **Por qué:** El móvil tiene restricciones de espacio y rendimiento (como el Cold Start del servidor). La adaptación debe ser armoniosa y simplificada si es necesario.

---

## 🧠 Ciclo de Retroalimentación del Conocimiento

Es **OBLIGATORIO** que tras solucionar un error o implementar una mejora significativa, se actualicen los siguientes archivos:

### 📁 `docs/LECCIONES_APRENDIDAS.md` (Proyecto Específico)
*   **Qué registrar:** Errores de sintaxis local, bugs de paridad entre web/móvil, configuraciones de endpoints y estados específicos de esta app.
*   **Objetivo:** Evitar que la IA cometa el mismo error dos veces en este proyecto.

### 📄 `CONOCIMIENTO_GLOBAL.md` (Ecosistema Global)
*   **Qué registrar:** Bugs de librerías externas (ej: Expo SDK), comportamientos extraños de sistemas operativos (Android vs iOS), y patrones de diseño premium que "enamoran" al usuario.
*   **Objetivo:** Crear una base de sabiduría que trascienda a otros proyectos futuros.

---

## 📋 Herramientas de Control de Sesión

Para que la transición entre chats sea perfecta:
1.  **Checklist:** Mantener actualizado `docs/CHECKLIST_PROXIMA_SESION.md` con las tareas pendientes exactas.
2.  **Plan:** Seguir la hoja de ruta en `docs/PLAN_MOVIL_FASE_2.md`.

---
**INSTRUCCIÓN PARA LA IA:** Al iniciar una sesión, lee este archivo y `LECCIONES_APRENDIDAS.md`. No saltes pasos del flujo armonioso.
