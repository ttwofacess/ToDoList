# To-Do List - Lista de Tareas Minimalista

Una aplicación web simple y elegante para gestionar tus tareas diarias. La interfaz es limpia, moderna y responsive, con soporte para tema claro y oscuro según las preferencias del sistema.

![ToDo List Screenshot](https://github.com/user-attachments/assets/102ad4ef-f4dd-42e0-bee2-259d2631963b) 

## ✨ Características

- **Añadir Tareas**: Agrega nuevas tareas fácilmente a través de un campo de entrada intuitivo.
- **Marcar como Completadas**: Haz clic en una tarea para marcarla como completada.
- **Edición de Tareas**: Modifica el texto de una tarea existente.
- **Prioridad de Tareas**: Asigna una prioridad (Alta, Media, Baja) para una mejor organización.
- **Fecha de Vencimiento**: Asigna una fecha a tus tareas.
- **Tareas Pendientes de Hoy**: Las tareas que vencen en el día actual se resaltan con una animación para llamar tu atención.
- **Eliminar Tareas**: Borra tareas que ya no necesites.
- **Ordenar Tareas**: Reorganiza tu lista para mostrar las tareas pendientes primero.
- **Persistencia de Datos**: Las tareas se guardan en el `localStorage` de tu navegador.
- **Diseño Moderno**: Interfaz de usuario actualizada con una paleta de colores agradable y tipografía moderna.
- **Tema Claro y Oscuro**: La apariencia se adapta automáticamente al tema de tu sistema operativo.
- **Soporte Multilenguaje**: La interfaz se muestra en español o inglés según el idioma del navegador.
- **Seguridad**: Utiliza `DOMPurify` para sanitizar las entradas del usuario y prevenir ataques XSS.
- **Opción de Donar**: Incluye un botón para donar a través de criptomonedas.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Para la estructura semántica de la aplicación.
- **CSS3**: Para los estilos, el diseño responsive y la tematización (claro/oscuro).
- **JavaScript (ES6+)**: Para toda la lógica de la aplicación.
- **Google Fonts**: Fuentes "Poppins" y "Roboto" para un diseño más pulido.
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