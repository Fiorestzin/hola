# 📋 Checklist - Sesión Siguiente (Presupuestos)

## ✅ Completado Hoy (2024-12-18)

### Metas de Ahorro - COMPLETO
- [x] Crear meta (nombre, monto, fecha obligatoria, ícono, color)
- [x] Eliminar meta con confirmación
- [x] Aportar a meta desde cualquier banco
- [x] Retiro temporal (monto, motivo, banco origen, fecha reponer)
- [x] Historial de aportes (últimos 10)
- [x] Proyecciones diaria/semanal/mensual
- [x] Completar meta al 100%
- [x] Saldo comprometido en Home (total y por banco)
- [x] Pendiente reponer por banco
- [x] Botones de fecha rápida (workaround para Expo Go)

---

## 🎯 Próxima Sesión: PRESUPUESTOS

### Fase 2 - Presupuestos
- [ ] Ver presupuestos existentes (consumido vs límite)
- [ ] Crear presupuesto (categoría, monto, periodo)
- [ ] Editar presupuesto
- [ ] Eliminar presupuesto
- [ ] Alertas de presupuesto excedido
- [ ] Barra de progreso visual

### Endpoints backend necesarios:
- `GET /budgets?environment=PROD`
- `POST /budgets`
- `PUT /budgets/{id}`
- `DELETE /budgets/{id}`

---

## 🔧 Notas Técnicas

### Para iniciar mañana:
1. `cd app/mobile-app`
2. `npx expo start --tunnel`
3. Revisar `docs/LECCIONES_APRENDIDAS.md`

### DateTimePicker:
- Actualmente usa botones rápidos (workaround Expo Go)
- Para APK final: volver a habilitar `@react-native-community/datetimepicker`
- Requerirá: `npx expo prebuild` + build nativo

---

## 📊 Fases Pendientes después de Presupuestos

1. **Fase 3:** Reportes Avanzados (gráficos, filtros, drill-down)
2. **Fase 4:** Gestión Categorías/Bancos (crear, editar, eliminar)
3. **Fase 5:** Filtros de fecha + extras
4. **Fase 6:** Reorganizar navegación a 5 pestañas + sub-pantallas
5. **Final:** Build APK con DateTimePicker nativo
