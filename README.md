# To-Do List - Lista de Tareas Minimalista

Una aplicación web simple y elegante para gestionar tus tareas diarias. La interfaz es limpia, moderna y responsive, con soporte para tema claro y oscuro según las preferencias del sistema.

![ToDo List Screenshot](https://github.com/user-attachments/assets/102ad4ef-f4dd-42e0-bee2-259d2631963b) 

## ✨ Características

- **Añadir Tareas**: Agrega nuevas tareas fácilmente a través de un campo de entrada intuitivo.
- **Subtareas (Checklist)**: Permite añadir una lista de subtareas dentro de una tarea principal para gestionar proyectos complejos.
- **Tareas Recurrentes**: Opción para que las tareas se repitan diaria, semanal o mensualmente, con reinicio automático de estado.
- **Marcar como Completadas**: Haz clic en una tarea o subtarea para marcarla como completada.
- **Edición de Tareas**: Modifica el texto de una tarea existente en cualquier momento.
- **Prioridad de Tareas**: Asigna una prioridad (Alta, Media, Baja) con indicadores visuales de color.
- **Fecha de Vencimiento**: Asigna una fecha a tus tareas para un mejor seguimiento.
- **Tareas Pendientes de Hoy**: Las tareas que vencen hoy se resaltan con una animación de pulso.
- **Modo Enfoque**: Filtra la lista para mostrar solo las tareas importantes de hoy.
- **Arrastrar y Soltar (Drag & Drop)**: Reorganiza manualmente el orden de tus tareas arrastrándolas.
- **Exportar e Importar**: Guarda una copia de seguridad de tus tareas en un archivo JSON o impórtalas en otro dispositivo.
- **Eliminar Tareas**: Borra tareas o subtareas que ya no necesites.
- **Ordenar Tareas**: Reorganiza automáticamente la lista para mostrar las tareas pendientes al principio.
- **Persistencia de Datos**: Todo se guarda automáticamente en el `localStorage` de tu navegador.
- **Diseño Moderno y Adaptativo**: Interfaz limpia con una paleta de colores moderna y totalmente responsive.
- **Tema Claro y Oscuro**: La apariencia se adapta automáticamente a las preferencias de tu sistema.
- **Soporte Multilenguaje**: Disponible en español e inglés según la configuración de tu navegador.
- **Seguridad**: Sanitización de entradas con `DOMPurify` para prevenir ataques XSS.
- **Opción de Donar**: Soporte para donaciones en criptomonedas integrado en la interfaz.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Para la estructura semántica de la aplicación.
- **CSS3**: Para los estilos, el diseño responsive y la tematización (claro/oscuro).
- **JavaScript (ES6+)**: Para toda la lógica de la aplicación.
- **Fuentes Locales**: Las fuentes "Poppins" y "Roboto" están auto-alojadas para optimizar el rendimiento y la privacidad.
- **DOMPurify**: Para la sanitización de HTML y prevención de XSS.

## 🚀 Cómo Usar

No se requiere ninguna instalación. Simplemente abre el archivo `index.html` en tu navegador web.

1.  Clona o descarga este repositorio.
2.  Navega a la carpeta del proyecto.
3.  Abre `index.html` en tu navegador.

## 🎨 Personalización

Puedes personalizar la apariencia modificando las variables CSS en la parte superior de `style.css`.

```css
:root {
    --bckgrndbdy: #F0F2F5;      /* Fondo principal */
    --btnordr: #6C63FF;         /* Botón de ordenar */
    --btnplus: #FF6584;         /* Botón de añadir (+) */
    --donetsk: #50C878;         /* Tareas completadas */
    --wrpprbck: #FFFFFF;       /* Fondo del contenedor principal */
    --maintxt: #333333;         /* Color del texto principal */
    --primary: #6C63FF;         /* Color de acento principal */
    --shadow: 0 4px 6px rgba(0,0,0,0.1); /* Sombra del contenedor */
}
```