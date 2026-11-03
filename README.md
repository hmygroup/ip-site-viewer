# IP del sitio

Extensión de Chrome (Manifest V3) que muestra la IP del sitio que estás visitando, teniendo en cuenta que detrás de un proxy corporativo Chrome solo ve la IP del proxy.

## Qué muestra

- **IP de conexión:** la IP a la que Chrome se conectó (`webRequest` → `details.ip`). Con proxy suele ser la del proxy, o Chrome no informa de ninguna.
- **IP real del sitio:** resuelta con el DNS del equipo mediante un host nativo opcional.
- **Veredicto de proxy:** si ambas IP no coinciden, avisa de que hay proxy, balanceador o CDN. Sin IP real, usa una heurística: la misma IP de conexión para 5 o más sitios distintos se marca como probable proxy.
- **Icono:** el último octeto de la IP en la barra (`v6` para IPv6). Azul: directo. Naranja: probable proxy.
- **Burbuja flotante** (opcional): pastilla arrastrable en las páginas. Clic para expandir, doble clic para copiar la IP, el punto naranja indica proxy. Se activa desde el popup y recuerda su posición.

## Instalación

1. Abre `chrome://extensions` y activa el **modo desarrollador** (gratis; algunas políticas corporativas lo bloquean).
2. **Cargar descomprimida** y elige esta carpeta.
3. Tras actualizar los ficheros, pulsa **Recargar** en la extensión y refresca las pestañas abiertas.

Con esto ya se ve la IP de conexión.

### Host nativo (IP real de sitios de la intranet)

Chrome no permite a las extensiones consultar el DNS, así que para ver la IP real de los sitios que pasan por proxy hace falta un pequeño host nativo (Python) que use el resolver del sistema:

```powershell
cd native
.\install.ps1 -ExtensionId <ID de chrome://extensions>
```

Reinicia Chrome después. Requisitos: Windows, Python en el `PATH`. Registra el host para Chrome y Edge en `HKCU` (no requiere administrador).

### DNS público (opcional)

El popup tiene una casilla para resolver con Cloudflare DoH cuando no hay host nativo. Está desactivada por defecto: envía el nombre del sitio fuera de la empresa y no resuelve nombres internos.

## Estructura

| Fichero | Función |
|---|---|
| `manifest.json` | Permisos y declaración MV3 |
| `background.js` | Captura la IP por pestaña, heurística de proxy, resolución (nativo/DoH) y respuestas a la burbuja |
| `popup.html` / `popup.js` | Popup con IP de conexión, IP real, veredicto y ajustes |
| `bubble.js` | Content script de la burbuja (Shadow DOM, solo marco principal) |
| `native/host.py` | Host nativo: `getaddrinfo` del SO vía Native Messaging |
| `native/install.ps1` | Registra el host en Chrome y Edge |

## Limitaciones

- La IP real es la que resuelve **este equipo**; el proxy puede resolver el nombre de otra forma.
- Sin host nativo, no se puede conocer la IP real de sitios que pasan por proxy.
- Con proxy, Chrome puede no dar IP de conexión. La burbuja muestra entonces "IP no disponible".
- La burbuja no aparece en iframes, `chrome://` ni en la Chrome Web Store.
- La política de proxy corporativa puede impedir leer la configuración de proxy; el resto sigue funcionando.

## Privacidad

Todo es local. Lo único que sale del equipo es la consulta a Cloudflare, y solo si activas la casilla DoH.
