# Lecciones Aprendidas - Proyecto Móvil

Este archivo documenta errores encontrados y soluciones aplicadas para que futuras sesiones de IA no los repitan.

---

## ❌ Error: `java.lang.String cannot be cast to java.lang.Boolean`

**Fecha:** 2024-12-16  
**Contexto:** App móvil con Expo SDK 54 + React Native en Android

**Causa:** La librería `@react-navigation/bottom-tabs` tiene un bug de compatibilidad con ciertas versiones de Android donde propiedades booleanas (como `headerShown: false`) causan un error de casting de tipos.

**Solución aplicada:** NO usar `react-navigation`. En su lugar, implementar navegación manual con `useState` y `TouchableOpacity` para simular tabs.

**Código de ejemplo funcional:**
```javascript
const [screen, setScreen] = useState('home');
// ... luego mostrar contenido condicionalmente con {screen === 'home' && ...}
// ... y usar botones TouchableOpacity como tabs
```

---

## ❌ Error: Propiedad `gap` en StyleSheet

**Contexto:** Estilos CSS en React Native

**Causa:** La propiedad `gap` (para espaciado en flexbox) no es soportada en todas las versiones de React Native/Android.

**Solución:** Usar `marginRight`, `marginLeft`, `marginBottom` en su lugar.

---

## ❌ Error: `SyntaxError: JSON Parse error: Unexpected character: N`

**Fecha:** 2024-12-17  
**Contexto:** App móvil Expo intentando hacer POST a API

**Causa:** La URL de la API era incorrecta. Apuntaba a una URL que no existía, el servidor devolvió "Not Found" (HTML) y la app intentó parsearlo como JSON.

**Solución aplicada:** 
1. Verificar la URL correcta del backend: `https://finanzas-api-evw9.onrender.com`
2. Agregar validación del `content-type` antes de parsear JSON
3. Mostrar mensajes amigables si el servidor no responde correctamente

**URLs del proyecto:**
- Frontend (web): `https://finanzas-web-mdk8.onrender.com`
- Backend (API): `https://finanzas-api-evw9.onrender.com`

---

## ❌ Error: EAS Build falla con `Permission denied` en assets

**Fecha:** 2024-12-17  
**Contexto:** Intentando compilar APK con `eas build -p android`

**Errores encontrados:**
1. `package.json does not exist in /home/expo/workingdir/build/app/mobile-app` - EAS no encontraba la raíz del proyecto
2. `tar: assets/adaptive-icon.png: Cannot open: Permission denied` - OneDrive bloqueando archivos

**Causa:** El proyecto está en una carpeta sincronizada con OneDrive. OneDrive puede bloquear archivos para sincronización, causando errores de permisos cuando EAS intenta empaquetarlos.

**Soluciones:**
1. **Mover proyecto fuera de OneDrive** - Copiar a `C:\Proyectos\mobile-app\` y hacer build desde ahí
2. **Inicializar git** - Ayuda a EAS a identificar la raíz del proyecto: `git init`
3. **Usar Expo Go** - Para desarrollo/uso personal, seguir con `npx expo start --tunnel`

**Estado:** ✅ SOLUCIONADO. Al mover el proyecto a `C:\Users\adrim\Proyectos\mobile-app`, inicializar git y limpiar caché, el build funcionó correctamente. La app tarda un poco en cargar datos la primera vez (Cold Start de Render), pero luego funciona perfecto.

---

## ❌ Error: `UnableToResolveError` con DateTimePicker nativo

**Fecha:** 2024-12-18  
**Contexto:** App móvil Expo Go + `@react-native-community/datetimepicker`

**Error:** `Unable to resolve module ./specs/NativeModuleDatePicker`

**Causa:** La librería `@react-native-community/datetimepicker` requiere **módulos nativos** que no están disponibles en Expo Go. Esta librería necesita un **development build** o APK compilado para funcionar.

**Soluciones:**
1. **Para desarrollo en Expo Go:** Usar botones de selección de fecha rápida (1 mes, 3 meses, etc.) sin módulos nativos
2. **Para APK final:** Al hacer `npx expo prebuild` + `npx expo run:android`, el DateTimePicker funcionará con calendario nativo

**Código alternativo para Expo Go:**
```javascript
// En lugar de DateTimePicker, usar botones:
{[{ label: '1 mes', months: 1 }, { label: '3 meses', months: 3 }].map(opt => (
  <TouchableOpacity onPress={() => {
    const d = new Date();
    d.setMonth(d.getMonth() + opt.months);
    setFecha(d);
  }}>
    <Text>{opt.label}</Text>
  </TouchableOpacity>
))}
```

**Nota:** Cuando se genere el APK final, volver a habilitar `@react-native-community/datetimepicker`.

---

## 📝 Notas de Configuración

- **Expo SDK:** 54.0.0
- **Conexión:** Usar modo `--tunnel` para conectar celular y PC en redes diferentes
- **URL del túnel:** Cambia cada vez que se reinicia el servidor. Verificar en `http://localhost:8081`

---

---

## ❌ Error: `tar: screens/...: Cannot open: Permission denied` (EAS Build)

**Fecha:** 2024-12-18  
**Contexto:** Ejecutando `eas build` en servidor de Expo Cloud.

**Causa:** La carpeta `screens/` (archivos antiguos de una versión anterior) tenía atributos de archivo bloqueados por OneDrive. Al intentar comprimir el proyecto para subirlo a la nube, el comando `tar` fallaba por falta de permisos.

**Solución aplicada:** Como la aplicación actual es monolítica (todo en `App.js`), se eliminó físicamente la carpeta `screens/`. Esto permitió que el empaquetado de EAS Build fluyera sin errores.

---

## ❌ Error: `npx expo prebuild ... exited with non-zero code: 1`

**Fecha:** 2024-12-18  
**Contexto:** Fase de `Prebuild` en Android (específicamente `withAndroidIcons.js`).

**Causa:** Los archivos de iconos adaptativos en `/assets` (ej: `adaptive-icon.png`) tenían metadatos o formatos que Expo 54 no podía procesar correctamente desde carpetas sincronizadas.

**Solución aplicada:** 
1. Eliminar la carpeta `android/` local si existe.
2. Simplificar `app.json` quitando la sección `adaptiveIcon` y `splash` detallada.
3. Usar el `icon.png` principal como icono único para asegurar compatibilidad rápida.

---

## ❌ Error: `CommandError: Project root directory not found`

**Fecha:** 2024-12-18  
**Contexto:** Ejecutar `npx expo install --fix` o comandos de EAS.

**Causa:** Ejecutar el comando desde fuera de la carpeta del proyecto (ej: desde `C:\Users\adrim\`).

**Solución:** Siempre hacer `cd` hasta la carpeta donde está el `package.json` (`.../mobile-app`) antes de lanzar comandos de compilación.

---

## 🔧 Cómo usar este archivo

Al iniciar una nueva sesión de chat con IA, pega esto al principio:
> "Revisa el archivo `docs/LECCIONES_APRENDIDAS.md` antes de hacer cambios en la app móvil."

