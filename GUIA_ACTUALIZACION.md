# Guía de Actualización del Proyecto (Git + Render)

Esta guía explica el flujo de trabajo profesional para actualizar tu aplicación financiera sin perder datos y manteniendo todo seguro.

## 1. Conceptos Clave

-   **Repositorio Local (Tu PC):** Donde programas, rompes cosas y pruebas (Tu "Taller").
-   **Repositorio Remoto (GitHub):** La nube donde se guarda una copia exacta de tu código. Es el puente.
-   **Render:** El servidor que toma el código de GitHub y lo pone en internet para que lo uses.

## 2. Flujo de Trabajo

Cada vez que quieras subir cambios (una vez que ya probaste que funcionan en tu PC), sigues estos 3 pasos sagrados en la terminal:

### Paso 1: Ver qué cambió (Opcional pero recomendado)
```bash
git status
```
*Te muestra archivos en rojo (modificados) o verde (listos para guardar).*

### Paso 2: Preparar los cambios ("Stage")
```bash
git add .
```
*El punto `.` significa "todo". Le dices a Git: "Quiero incluir TODOS los archivos modificados en este paquete".*

### Paso 3: Guardar el paquete ("Commit")
```bash
git commit -m "Descripción breve de lo que hiciste"
```
*Creas una "versión" o "foto" del código en este momento. El mensaje `-m` es vital para saber qué cambiaste (ej: "Agregado botón completar meta").*

### Paso 4: Enviar a la nube ("Push")
```bash
git push
```
*Subes tu "paquete" a GitHub. Aquí termina tu trabajo.*

## 3. ¿Qué pasa después? (Automático)

1.  **GitHub** recibe tu código nuevo.
2.  **Render** detecta el cambio en GitHub inmediatamente.
3.  **Render** inicia el proceso de "Deploy":
    *   Baja el código nuevo.
    *   Construye la aplicación (`npm run build`).
    *   Reinicia el servidor.
    *   Ejecuta migraciones de base de datos (si hay tablas nuevas, las crea en Supabase).

## 4. Preguntas Frecuentes

**¿Perderé mis datos?**
*   No, si usas una base de datos externa como **Supabase**. El código cambia, pero los datos viven seguros en otro lado.

**¿Cuánto tarda?**
*   Generalmente entre 2 a 5 minutos desde que haces el `git push` hasta que ves los cambios en tu web pública.

**¿Puedo romper algo?**
*   Si el código tenía errores, Render podría fallar al iniciar. Por eso siempre probamos primero en local (`localhost`). Si falla, arreglas en local y vuelves a subir.
