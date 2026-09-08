# Seguiment

Aplicació web per al **seguiment psicopedagògic i l'orientació educativa** a centres de primària i secundària. Pensada per a orientadors, tutors i equips docents que necessiten registrar actuacions amb rapidesa i, alhora, poder justificar-les davant d'una revisió del Departament d'Educació.

No és una eina només per a alumnat NESE o NEE: qualsevol seguiment individualitzat, entrevista amb famílies o coordinació amb serveis externs hi té cabuda.

**Les dades no surten mai del dispositiu.** Tot es desa al navegador (`localStorage`), amb xifratge opcional amb contrasenya.

---

## Característiques

**Agenda de primer nivell**
Vistes de mes, setmana, dia i llista. Reprogramació per arrossegament a l'escriptori, franges de disponibilitat setmanal, detecció de solapaments, cites recurrents, recordatoris, marcatge d'assistència, exportació ICS i generació de convocatòries.

**Registres de seguiment amb traçabilitat**
Entrevistes, coordinacions, observacions d'aula, aplicació de proves, derivacions, incidències i CAD. Cada edició crea una versió nova amb data i motiu; les anteriors queden consultables. Passats uns dies configurables el registre es consolida i qualsevol canvi posterior requereix justificació. L'eliminació sempre és lògica.

**Entrada de dades ràpida**
Herència de context en crear registres des d'una fitxa o des d'una cita, plantilles per tipus de registre, banc de frases reutilitzables, autocompletat sobre valors ja existents, snippets dinàmics (`{{alumne}}`, `{{curs}}`, `{{data}}`, `{{tutor}}`, `{{professional}}`, `{{centre}}`) i generació automàtica de tasques a partir dels acords. Tot el que s'autoempleta queda marcat com a suggerit i és editable.

**Justificació davant d'inspecció**
Versionat dels registres consolidats (cada modificació en conserva la versió anterior i el motiu), cadena documental del cas que marca visualment els passos sense constància, catàleg normatiu editable (Decret 150/2017, Decret 175/2022, protocols del Departament…) associable a cada mesura, i control de terminis preceptius amb panell de compliment.

**Estadístiques**
Tres nivells d'anàlisi —alumne, grup i nivell, i global de centre— amb selector de període. Gràfics SVG construïts per codi, sense llibreries. Exportació a CSV i memòria estadística imprimible.

**Documents imprimibles**
Informe de seguiment, full de derivació, acta d'entrevista, convocatòria, resum de cas per a traspàs, dossier d'inspecció i memòria estadística. Sortida neta amb capçalera del centre i data de generació.

**Bilingüe, responsive i instal·lable**
Interfície completa en català i castellà. Disseny *mobile first* amb navegació inferior en pantalles petites i lateral a l'escriptori. PWA instal·lable que funciona sense connexió.

---

## Ús

L'aplicació és estàtica i no necessita cap procés de compilació, però sí que s'ha de servir per HTTP (els mòduls ES i el service worker no funcionen des de `file://`).

```bash
git clone https://github.com/vmoren12/seguiment.git
cd seguiment
node tools/serve.mjs        # http://localhost:8080
```

Qualsevol servidor estàtic serveix igualment (`python -m http.server`, `npx serve`, Apache, Nginx…).

Per publicar-la a GitHub Pages: **Settings → Pages → Source: GitHub Actions**. El flux de treball inclòs (`.github/workflows/pages.yml`) desplega el contingut del repositori a cada `push` a `main`.

### Primers passos

1. **Configuració → Dades del centre**: nom, codi, curs escolar i professional responsable (signa els registres i els documents).
2. **Configuració → Cursos i grups** i **Agenda i disponibilitat**.
3. Alta d'alumnat, o bé **Carrega dades d'exemple** des de l'escriptori per veure com funciona.
4. **Configuració → Dades**: exporteu una còpia de seguretat periòdicament. L'aplicació us ho recorda.

### Dreceres

| Drecera | Acció |
| --- | --- |
| `Ctrl` + `K` | Cerca ràpida d'alumnat, cites i registres |
| `Ctrl` + `M` | Element nou |
| `Ctrl` + `Retorn` | Desa el formulari obert |
| `Esc` | Tanca el diàleg |

---

## Estructura

```
index.html              Estructura de la pàgina
manifest.webmanifest    Manifest de la PWA
sw.js                   Service worker (funcionament sense connexió)
css/                    base · layout · components · print
js/
  core/                 utilitats, dates, i18n, estat, persistència, xifratge, exportació
  domain/               esquema, accions, selectors, indicadors, dades d'exemple
  ui/                   dom, encaminador, estructura, editors, documents
    components/         modal, avisos, formularis, gràfics
    views/              escriptori, agenda, alumnat, fitxa, tasques, compliment,
                        demandes, serveis, estadístiques, documents, configuració
tools/                  servidor local, generador d'icones, autodiagnòstic
```

Les capes són estrictes: `core` no coneix el domini, `domain` no coneix la interfície i `ui` no escriu mai directament a l'estat (tot passa per `domain/actions.js`, que manté la integritat referencial).

### Autodiagnòstic

Amb el servidor engegat, obriu `http://localhost:8080/tools/selftest.html`. Comprova la càrrega de tots els mòduls, el càlcul de dates i indicadors, el desat i l'esborrat en cascada, el versionat dels registres, l'exportació i la importació, l'escapament d'HTML, el renderitzat de totes les vistes i formularis, l'etiquetatge dels camps i el rendiment amb 500 alumnes i 5.000 registres.

---

## Privacitat i protecció de dades

Les dades es desen exclusivament al navegador del dispositiu. No hi ha servidor, ni analítica, ni cap petició a l'exterior.

- **Bloqueig opcional amb contrasenya**: xifra el magatzem local amb AES-GCM i PBKDF2-SHA256 (250.000 iteracions). Si es perd la contrasenya, les dades no es poden recuperar.
- **Mode de presentació**: mostra només inicials, per a reunions i projeccions.
- **Esborrat total** amb doble confirmació i paraula de seguretat.

El centre educatiu és el responsable del tractament als efectes del RGPD (UE) 2016/679 i de la LOPDGDD 3/2018. Li correspon determinar la base jurídica, informar les persones interessades, aplicar les mesures de seguretat adequades i atendre els drets d'accés, rectificació, supressió, limitació, portabilitat i oposició. **Les còpies de seguretat exportades contenen dades de categoria especial i s'han de custodiar xifrades.**

---

## Decisions de disseny

- **Sense dependències ni compilació.** Mòduls ES natius, CSS pla i SVG generat per codi. El projecte s'obre, es llegeix i es modifica sense cap cadena d'eines.
- **Un fitxer per capa, no un fitxer únic.** L'especificació original demanava un sol HTML autònom; per poder ser una PWA instal·lable i offline calen un manifest i un service worker, i els mòduls ES no es carreguen des de `file://`. S'ha mantingut l'esperit —zero dependències, desplegable com a estàtic— i s'ha guanyat mantenibilitat.
- **Escriure mai ha de fer saltar el cursor.** Els canvis de configuració es desen a cada pulsació però sense repintar la vista, i el repintat conserva el camp actiu i la posició del cursor. Cap escriptura passa per fora de `domain/actions.js`.
- **Eliminació sempre lògica.** Res s'esborra: es marca com a anul·lat amb motiu i data, i les entitats dependents s'anul·len en cascada.
- **Renderitzat previsible.** Cada vista genera una cadena d'HTML i el contenidor es reemplaça d'un sol cop; els esdeveniments es gestionen per delegació amb atributs `data-act`. No hi ha manipulació dispersa del DOM.
- **Escapament per defecte.** La plantilla `html` escapa tota interpolació; el text que ha de passar sense escapar s'ha de marcar explícitament amb `raw()`.
- **Indicadors memoritzats** i invalidats per revisió de l'estat, de manera que canviar de període no recalcula res que ja s'hagi calculat.
- **Català com a idioma de referència.** Les claus que falten en un altre idioma hi recauen automàticament, així una traducció incompleta mai deixa la interfície buida.
- **Colors només per a estats.** Una única tinta d'accent i colors semàntics reservats a pendent, vençut, fet i anul·lat, més els tipus de cita configurables.

## Possibles extensions

- Sincronització opcional xifrada d'extrem a extrem entre dispositius del mateix professional.
- Perfils amb permisos diferenciats (orientació, tutoria, direcció) sobre registres restringits.
- Importació de l'alumnat des dels fitxers d'Esfera o de la matrícula del centre.
- Instruments d'avaluació amb barems incorporats i càlcul automàtic de puntuacions.
- Signatura de consentiments a la mateixa pantalla, amb segell temporal.
- Detecció de patrons d'absentisme a partir de les dades d'assistència.
- Vista d'equip amb assignació de casos entre diversos professionals d'orientació.

---

## Llicència

MIT. Vegeu [LICENSE](LICENSE).

---

## Resumen en castellano

Aplicación web para el seguimiento psicopedagógico y la orientación educativa en centros de primaria y secundaria. Registra actuaciones, entrevistas, coordinaciones, derivaciones y consentimientos; gestiona la agenda; calcula indicadores por alumno, grupo y centro; y genera documentos imprimibles, incluido un dosier de inspección. Interfaz completa en catalán y castellano.

Los datos se guardan únicamente en el navegador del dispositivo, con cifrado opcional mediante contraseña. Es una PWA instalable que funciona sin conexión, sin dependencias ni proceso de compilación: basta con servir el repositorio como sitio estático.
