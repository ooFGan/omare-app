# **Documento de Especificación de Requerimientos (ERS)**

## **Aplicación Web de Proformas para Pedidos**

---

## **1\. Introducción**

### **1.1 Propósito del Documento**

El presente documento define los requerimientos funcionales y no funcionales para el desarrollo de una **Aplicación Web de Gestión de Proformas y Pedidos**, destinada al equipo comercial para la creación, consulta y gestión de clientes y pedidos.

### **1.2 Alcance del Sistema**

La aplicación permitirá:

* Autenticación de usuarios comerciales.

* Creación y gestión de clientes.

* Creación, modificación y repetición de pedidos.

* Visualización del histórico de pedidos por cliente.

* Gestión de referencias de productos mediante archivo `.csv`.

* Generación de pedidos en formato PDF.

* Cálculo automático de totales con IVA (21%).

* Interfaz moderna y completamente responsive.

* Uso de **Supabase** como:

  * Base de datos

  * Sistema de autenticación

  * Almacenamiento (si se requiere para PDFs)

---

## **2\. Descripción General**

### **2.1 Tipo de Aplicación**

Aplicación Web moderna (SPA o similar), accesible desde navegador, optimizada para:

* Escritorio

* Tablet

* Móvil

### **2.2 Usuarios del Sistema**

| Rol | Descripción |
| ----- | ----- |
| Comercial | Usuario autenticado que gestiona clientes y pedidos |

No se contempla inicialmente rol administrador, aunque podrá añadirse en futuras versiones.

---

## **3\. Requerimientos Funcionales**

---

## **3.1 Autenticación**

### **RF-01: Inicio de sesión**

* El usuario deberá introducir:

  * Usuario (email)

  * Contraseña

* La autenticación será gestionada mediante **Supabase Authentication**.

* Solo usuarios autenticados podrán acceder al sistema.

---

## **3.2 Gestión de Clientes**

### **RF-02: Crear Cliente**

El sistema permitirá crear un cliente con los siguientes campos:

| Campo | Obligatorio |
| ----- | ----- |
| Nombre | Sí |
| Dirección | No |
| Teléfono | No |
| Observaciones | No |

Validaciones:

* El nombre es obligatorio.

* No se permitirá guardar sin nombre.

---

### **RF-03: Editar Cliente**

* Se podrá modificar cualquier campo del cliente.

* Se guardarán cambios en base de datos.

---

### **RF-04: Listado de Clientes**

* Visualización en tabla o tarjetas.

* Buscador por nombre.

* Acceso al detalle del cliente al hacer clic.

---

### **RF-05: Histórico de Cliente**

Al acceder a un cliente:

* Se mostrará listado de todos sus pedidos anteriores.

* Cada pedido podrá:

  * Visualizarse en pantalla

  * Descargarse en PDF

* Se podrá repetir un pedido existente.

---

## **3.3 Gestión de Pedidos**

---

### **RF-06: Crear Pedido**

Desde un cliente:

* Crear nuevo pedido.

* Se asignará fecha automática.

* Se vinculará al cliente.

---

### **RF-07: Añadir Productos al Pedido**

El comercial podrá:

* Ver listado de referencias disponibles.

* Buscar referencias.

* Añadir productos.

* Modificar:

  * Cantidad

  * Precio unitario

---

### **RF-08: Cálculos Automáticos**

El sistema calculará automáticamente:

* Subtotal (suma líneas)

* IVA 21%

* Total con IVA

* Cantidad total de cajas

Fórmula IVA:

IVA \= Subtotal \* 0.21  
Total \= Subtotal \+ IVA  
---

### **RF-09: Modificar Pedido**

Mientras el pedido no esté cerrado:

* Se podrán modificar productos.

* Cambiar cantidades.

* Cambiar precios.

* El sistema recalculará automáticamente totales.

---

### **RF-10: Repetir Pedido**

Desde el histórico:

* Botón “Repetir pedido”.

* Generará nuevo pedido editable con mismas líneas.

---

### **RF-11: Generar PDF**

El sistema permitirá:

* Generar PDF del pedido.

* Descargar PDF.

* Visualizar PDF en pantalla.

El PDF deberá incluir:

* Datos del cliente

* Fecha

* Número de pedido

* Tabla de productos

* Subtotal

* IVA 21%

* Total

* Total cajas

---

## **3.4 Gestión de Referencias**

---

### **RF-12: Carga de Referencias desde CSV**

Las referencias de productos:

* Se cargarán desde un archivo `.csv`.

* El archivo estará ubicado en la carpeta del proyecto.

* El archivo podrá modificarse manualmente cuando:

  * Se agreguen nuevas referencias.

  * Se eliminen productos sin stock u obsoletos.

Campos esperados del CSV:

* Código

* Descripción

* Precio base

* Unidades por caja (opcional)

El sistema deberá:

* Leer el archivo al iniciar la aplicación.

* Actualizar listado automáticamente cuando cambie el archivo (según implementación).

---

## **4\. Requerimientos No Funcionales**

---

### **RNF-01: Interfaz**

* Diseño moderno.

* Responsive.

* UX clara y rápida.

* Compatible con navegadores modernos:

  * Chrome

  * Edge

  * Firefox

  * Safari

---

### **RNF-02: Seguridad**

* Autenticación obligatoria.

* Protección de rutas.

* Uso de HTTPS.

* Gestión segura de credenciales mediante **Supabase**.

---

### **RNF-03: Rendimiento**

* Tiempo de carga \< 3 segundos.

* Operaciones CRUD rápidas (\<1 segundo ideal).

---

### **RNF-04: Escalabilidad**

Arquitectura preparada para:

* Añadir roles.

* Añadir estados de pedido.

* Integración futura con ERP.

---

### **RNF-05: Persistencia**

* Base de datos alojada en **Supabase**.

* Backups automáticos configurados en entorno productivo.

---

## **5\. Modelo de Datos Propuesto**

---

### **Tabla: usuarios**

(Gestionada por Supabase Auth)

---

### **Tabla: clientes**

| Campo | Tipo |
| ----- | ----- |
| id | UUID |
| nombre | text |
| direccion | text |
| telefono | text |
| observaciones | text |
| created\_at | timestamp |

---

### **Tabla: pedidos**

| Campo | Tipo |
| ----- | ----- |
| id | UUID |
| cliente\_id | UUID |
| fecha | timestamp |
| subtotal | numeric |
| iva | numeric |
| total | numeric |
| total\_cajas | integer |

---

### **Tabla: pedido\_lineas**

| Campo | Tipo |
| ----- | ----- |
| id | UUID |
| pedido\_id | UUID |
| codigo\_referencia | text |
| descripcion | text |
| cantidad | integer |
| precio\_unitario | numeric |
| total\_linea | numeric |

---

## **6\. Arquitectura Técnica Sugerida**

### **Frontend**

* Framework moderno (React, Vue o similar).

* Diseño con framework UI (Tailwind, Material UI, etc).

* Consumo de API Supabase.

### **Backend**

* Base de datos PostgreSQL gestionada por **Supabase**.

* Autenticación mediante Supabase Auth.

* Almacenamiento de PDFs opcional en Supabase Storage.

---

## **7\. Flujo Principal del Sistema**

1. Usuario inicia sesión.

2. Accede al listado de clientes.

3. Selecciona cliente o crea uno nuevo.

4. Crea pedido.

5. Añade referencias.

6. Modifica cantidades/precios.

7. Visualiza totales automáticos.

8. Genera PDF.

9. Guarda pedido.

10. Histórico disponible para repetición futura.

---

## **8\. Criterios de Aceptación**

* No se puede crear cliente sin nombre.

* El IVA siempre será 21%.

* El total debe calcularse correctamente.

* El histórico debe mostrar todos los pedidos del cliente.

* El PDF debe reflejar exactamente los datos visibles en pantalla.

* El sistema debe funcionar correctamente en móvil.

---

## **9\. Posibles Mejoras Futuras**

* Estados de pedido (Borrador, Enviado, Confirmado).

* Firma digital.

* Envío automático por email.

* Dashboard de ventas.

* Control de stock.

* Multiusuario con permisos.

