import "@lobaton/core/dist/core.bundle.css";
import * as Lo from "@lobaton/core";

// Cajetín de búsqueda
import "@lobaton/search/dist/search.bundle.css";
import "@lobaton/search";

// Bootstrap
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap4c-custom-switch/dist/css/component-custom-switch.css";
import "bootstrap.native";

// Estilo de la página
import "./index.sass";


window.onload = function() {
   window.interfaz = new Interfaz();
}

const Interfaz = (function() {

   function Interfaz() {
      this.g = Lo.lobaton({
         center: [37.45, -4.5],
         pathLoc: "json/localidades.json",
         unclusterZoom: 13,
         zoom: 8,
         ors: {key: "5b3ce3597851110001cf62489d03d0e912ed4440a43a93f738e6b18e"}
      });

      initialize.call(this);
      crearBarraLateral.call(this);
   }


   function initialize() {
      // Elimina localidades
      this.g.Localidad.filter("invisible", {});
      // Agrega los datos de la especialidad de informática.
      this.g.agregarCentros("json/590107.json");

      this.g.map.addControl(Lo.search.bar(this.g));

      // A efectos de depuración.
      this.g.on("markerselect", e => {
         const centro = e.newval;
         if(!centro) return;

         console.log(`Centro: ${centro.getData().id.nom} (${centro.getData().codigo})`);
         console.log("Marca: ", centro);
         console.log("Datos: ", centro.getData());
         console.log("Oferta: ", centro.getData().oferta);
         console.log("Adjudicaciones: ", centro.getData().adj);
      });
   }


   function crearBarraLateral() {
      const div = document.getElementById("map"),
            el = L.DomUtil.create("section", "leaflet-control", div);
      el.id = "sidebar";

      // Deshabilita los eventos del mapa al estar sobre la barra lateral
      el.addEventListener("dblclick", e => e.stopPropagation());
      el.addEventListener("contextmenu", e => e.stopPropagation());
      el.addEventListener("click", e => e.stopPropagation());
      el.addEventListener("mouseover", e => this.g.map.dragging.disable());
      el.addEventListener("mouseout", e => this.g.map.dragging.enable());
      el.addEventListener("mousewheel", e => e.stopPropagation());

      this.g.on("dataloaded", e => crearControles.call(this));
   } 

   function crearControles() {
      const container = L.DomUtil.get("sidebar");

      // CORRECCIONES.
      Array.from(document.getElementById("controlbar").content.children)
                .forEach(e => container.appendChild(e));
      document.getElementById("controlbar").remove();

      container.appendChild(crearGrupo.call(this, "correct:deseable", {
         titulo: "Enseñanzas deseables",
         field: "xxx",
         items: [{leyenda: "Elimina no deseables", value: "foobar"}]
      }));

      container.appendChild(crearGrupo.call(this, "correct:ofens", {
         titulo: "Eliminar enseñanzas",
         field: "ens",
         items: obtenerEns(this.g.general.ens)
      }));

      Array.from(document.getElementById("filterbar").content.children)
                .forEach(e => container.appendChild(e));
      document.getElementById("filterbar").remove();
      container.lastChild.id = "filterbar";

      container.lastChild.appendChild(crearFiltro.call(this, "filter:oferta", {
         titulo: "Eliminar centros sin oferta",
         opts: {min: 1}
      }));

   }

   return Interfaz;
})();


function obtenerEns(obj) {
   return Object.keys(obj).map(cod => new Object({leyenda: obj[cod].nombre, value: cod}));
}


// Crea un grupo de controles que permiten
// eliminar o reponer datos del mapa.
function crearGrupo(corr, opts) {
   const container = L.DomUtil.get("sidebar"),
         group = container.querySelector("template").content.firstElementChild.cloneNode(true),
         itemDiv = group.querySelector("template").content.firstElementChild;

   itemDiv.remove();
   group.querySelector("legend").textContent = opts.titulo;
   group.id = corr.replace(":", "_");

   for(const item of opts.items) {
      group.appendChild(crearItem(this.g.Centro, corr, itemDiv.cloneNode(true),
                                  opts.field, item.leyenda, item.value, opts.auto));
   }

   // Al aplicar la corrección se marcan y desmarcan
   // los controles correspondientes: útil si se aplica desde la consola.
   this.g.Centro.on(corr, e => {
      const [action, name] = corr.split(":"),
            inputs = Array.from(group.querySelectorAll("input")),
            values = e.opts[opts.field],
            inv = e.opts.inv;

      inputs.forEach(i => {
         const res = !!(inv ^ values.includes(i.value));
         i.checked = res;
         // Si se aplica automáticamente la corrección,
         // se deshabilita el control de la misma.
         if(e.auto && res) i.disabled = true;
      });
   });

   // Al desaplicar la corrección, deben desmarcarse
   // todos los controles correspondientes: útil si se aplica desde la consola.
   this.g.Centro.on(`un${corr}`, e => {
      const [action, name] = corr.split(":"),
            inputs = Array.from(group.querySelectorAll("input"));

      inputs.forEach(i => i.disabled = i.checked = false);
   });

   return group;
}


// Añade a la página un ítem del grupo. Por ejemplo,
// si se trata de instalaciones, añadir/eliminar la piscina.
function crearItem(Centro, id, div, field, legend, value, auto) {
   const input = div.querySelector("input"),
         iden = `${id.replace(":", "_")}_${value}`;

   div.querySelector("label").textContent = legend;
   div.querySelector("input").name = id;
   div.querySelector("input").id = iden;
   div.querySelector("input").value = value;
   div.querySelectorAll("label").forEach(label => label.setAttribute("for", iden));

   // Al (des)marcar un ítem, se aplica la correción
   // con todos los ítem del grupo marcados.
   input.addEventListener("change", e => {
      const [action, name] = id.split(":"),
            values = getValues(e.target);

      if(values.length) Centro[action](name, {[field]: values}, auto);
      else  Centro[`un${action}`](name);

      Centro.invoke("refresh");
   });

   return div;
}


// Lista de ítem marcados.
function getValues(input) {
   const section = input.closest("form");

   return Array.from(section.querySelectorAll("input"))
                    .filter(i => i.checked).map(i => i.value);
}


function crearFiltro(name, opts) {
   const template = document.getElementById("filterbar").firstElementChild.content,
         item = template.firstElementChild.cloneNode(true),
         input = item.querySelector("input"),
         id = name.replace(":", "_");

   item.querySelector("input").name = name;
   item.querySelector("input").id = id;
   item.querySelector("label").textContent = opts.titulo;
   item.querySelector("input").value = JSON.stringify(opts.opts);
   item.querySelectorAll("label").forEach(label => label.setAttribute("for", id));

   // Al (des)marcar un ítem, se (des)aplica el filtro
   // tomando las opciones contenidas en value.
   input.addEventListener("change", e => {
      const name = e.target.name.split(":")[1];

      if(e.target.checked) this.g.Centro.filter(name, JSON.parse(e.target.value));
      else this.g.Centro.unfilter(name);

      this.g.Centro.invoke("refresh");
   });

   return item;
}
