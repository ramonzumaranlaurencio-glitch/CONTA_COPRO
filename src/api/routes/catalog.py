"""
Endpoints del catálogo maestro de artículos.
Multi-empresa · Multi-rubro · PCGE Perú.
"""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.dependencies import get_current_context
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/catalog", tags=["Catalog"])

# =========================================================================
# DATOS DEL CATÁLOGO MAESTRO (cargados en memoria — fuente: itemCatalog.ts)
# Se sincronizan con el frontend para garantizar coherencia
# =========================================================================

RUBROS: dict[str, str] = {
    "GE": "General (Todas las empresas)",
    "MI": "Minería",
    "CO": "Construcción",
    "FA": "Fabricación / Manufactura",
    "CM": "Comercial / Ventas",
    "DI": "Distribución / Logística",
    "AG": "Agropecuario",
    "PE": "Pesca / Acuicultura",
    "SA": "Salud / Farmacéutico",
    "HO": "Hostelería / Restaurantes",
    "TR": "Transporte",
    "EN": "Energía / Utilities",
    "TE": "Tecnología / TI",
    "RE": "Inmobiliaria / Real Estate",
    "ED": "Educación",
}

PCGE_INVENTARIO: dict[str, str] = {
    "201": "Mercaderías manufacturadas",
    "202": "Mercaderías no manufacturadas",
    "211": "Productos terminados",
    "231": "Productos en proceso",
    "241": "Materias primas manufactureras",
    "242": "Materias primas no manufactureras",
    "251": "Materiales auxiliares",
    "252": "Suministros",
    "253": "Repuestos",
    "261": "Envases",
    "262": "Embalajes",
    "333": "Maquinaria y equipo de explotación",
    "334": "Unidades de transporte",
    "335": "Muebles y enseres",
    "336": "Equipos diversos",
    "337": "Herramientas y utensilios",
}

PCGE_GASTO: dict[str, str] = {
    "6021": "Compras de MP manufactureras",
    "6022": "Compras de MP no manufactureras",
    "6031": "Materiales auxiliares",
    "6032": "Suministros",
    "6033": "Repuestos",
    "6041": "Envases",
    "6042": "Embalajes",
    "6411": "Envases y embalajes",
    "6531": "Repuestos y accesorios",
    "6561": "Suministros - útiles de oficina",
    "6562": "Suministros - combustibles",
    "6563": "Suministros - pequeños instrumentos",
    "6564": "Suministros - EPP",
    "6569": "Suministros diversos",
    "6813": "Depreciación - maquinaria",
    "6814": "Depreciación - transporte",
    "6815": "Depreciación - muebles",
    "6816": "Depreciación - equipos",
    "6817": "Depreciación - herramientas",
    "6911": "Costo de ventas merc. manufactura",
    "6912": "Costo de ventas merc. no manufactura",
}

# Catálogo maestro en Python (espejo del TypeScript)
# Formato: code, name, aliases, cta, cta_name, gasto, gasto_name, nat, nat_name, tk, unit, rubros, ai_keywords
MASTER_CATALOG: list[dict[str, Any]] = [
    # ── Suministros de oficina ─────────────────────────────────────────────
    {"code":"252-SU-GE-0001-F","name":"Papel Bond A4 75g (millar)","cta":"252","gasto":"6561","nat":"SU","tk":"F","unit":"MIL","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["papel","bond","a4","fotocopia","millar","resma","75g"],"aliases":["papel bond a4","papel fotocopia","resma"]},
    {"code":"252-SU-GE-0002-F","name":"Papel Bond A4 80g (millar)","cta":"252","gasto":"6561","nat":"SU","tk":"F","unit":"MIL","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["papel","bond","80g","a4","resma"],"aliases":["papel bond 80","papel a4 80g"]},
    {"code":"252-SU-GE-0003-F","name":"Tóner impresora HP LaserJet","cta":"252","gasto":"6561","nat":"SU","tk":"F","unit":"UND","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["toner","cartucho","hp","laser","impresora","laserjet"],"aliases":["toner hp","cartucho laser"]},
    {"code":"252-SU-GE-0004-F","name":"Útiles de escritorio (set)","cta":"252","gasto":"6561","nat":"SU","tk":"F","unit":"SET","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["utiles","escritorio","lapiz","boligrafo","archivador","folder","papeleria"],"aliases":["utiles oficina","articulos escritorio"]},
    # ── Combustibles ───────────────────────────────────────────────────────
    {"code":"252-CO-GE-0001-F","name":"Gasolina 84 octanos (galón)","cta":"252","gasto":"6562","nat":"CO","tk":"F","unit":"GLN","rubros":["GE","MI","CO","FA","CM","DI","AG","PE","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["gasolina","84","combustible","gasohol","galones"],"aliases":["gasolina 84","combustible 84"]},
    {"code":"252-CO-GE-0002-F","name":"Gasolina 90 octanos (galón)","cta":"252","gasto":"6562","nat":"CO","tk":"F","unit":"GLN","rubros":["GE","MI","CO","FA","CM","DI","AG","TR","EN"],"ai_keywords":["gasolina","90","combustible"],"aliases":["gasolina 90"]},
    {"code":"252-CO-GE-0003-F","name":"Petróleo Diesel B5 (galón)","cta":"252","gasto":"6562","nat":"CO","tk":"F","unit":"GLN","rubros":["GE","MI","CO","FA","DI","AG","PE","TR","EN"],"ai_keywords":["diesel","petroleo","b5","gasoil"],"aliases":["diesel","petroleo b5"]},
    {"code":"252-CO-GE-0004-F","name":"Aceite motor SAE 20W50 (galón)","cta":"252","gasto":"6562","nat":"CO","tk":"F","unit":"GLN","rubros":["GE","MI","CO","FA","DI","AG","TR","EN"],"ai_keywords":["aceite","motor","20w50","lubricante","sae"],"aliases":["aceite motor 20w50","lubricante motor"]},
    # ── EPP ────────────────────────────────────────────────────────────────
    {"code":"252-EP-GE-0001-F","name":"Casco de seguridad Clase E","cta":"252","gasto":"6564","nat":"EP","tk":"F","unit":"UND","rubros":["GE","MI","CO","FA","AG","PE","EN","RE"],"ai_keywords":["casco","seguridad","industrial","obra","clase e","proteccion"],"aliases":["casco seguridad","casco de obra"]},
    {"code":"252-EP-GE-0002-F","name":"Guantes cuero/nitrilo seguridad","cta":"252","gasto":"6564","nat":"EP","tk":"F","unit":"PAR","rubros":["GE","MI","CO","FA","AG","PE","SA","EN"],"ai_keywords":["guantes","cuero","nitrilo","seguridad","proteccion","trabajo"],"aliases":["guantes seguridad","guantes industriales"]},
    {"code":"252-EP-GE-0003-F","name":"Zapatos seguridad punta acero","cta":"252","gasto":"6564","nat":"EP","tk":"F","unit":"PAR","rubros":["GE","MI","CO","FA","AG","PE","EN","RE"],"ai_keywords":["zapatos","botas","seguridad","punta","acero","calzado"],"aliases":["zapatos seguridad","botas industrial"]},
    {"code":"252-EP-GE-0004-F","name":"Chaleco reflectivo seguridad","cta":"252","gasto":"6564","nat":"EP","tk":"F","unit":"UND","rubros":["GE","MI","CO","FA","DI","AG","PE","TR","EN"],"ai_keywords":["chaleco","reflectivo","seguridad","naranja","alta visibilidad"],"aliases":["chaleco seguridad","chaleco reflectivo"]},
    {"code":"252-EP-GE-0005-F","name":"Mascarilla N95 respiratoria","cta":"252","gasto":"6564","nat":"EP","tk":"F","unit":"UND","rubros":["GE","MI","CO","FA","AG","SA","EN"],"ai_keywords":["mascarilla","n95","respirador","proteccion","facial"],"aliases":["mascarilla n95","respirador n95"]},
    # ── Minería ────────────────────────────────────────────────────────────
    {"code":"252-EX-MI-0001-F","name":"ANFO explosivo (kg)","cta":"252","gasto":"6562","nat":"EX","tk":"F","unit":"KGM","rubros":["MI","CO"],"ai_keywords":["anfo","explosivo","nitrato","amonio","fuel oil","voladura"],"aliases":["anfo","explosivo anfo"]},
    {"code":"252-EX-MI-0002-F","name":"Dinamita gelatinosa 60%","cta":"252","gasto":"6562","nat":"EX","tk":"F","unit":"KGM","rubros":["MI","CO"],"ai_keywords":["dinamita","explosivo","gelatina","voladura","60%"],"aliases":["dinamita","explosivo dinamita"]},
    {"code":"252-EX-MI-0003-F","name":"Detonador no eléctrico NONEL","cta":"252","gasto":"6562","nat":"EX","tk":"F","unit":"UND","rubros":["MI","CO"],"ai_keywords":["detonador","nonel","no electrico","fulminante","iniciador"],"aliases":["detonador nonel","fulminante"]},
    {"code":"252-QU-MI-0001-F","name":"Ácido sulfúrico 98% (kg)","cta":"252","gasto":"6569","nat":"QU","tk":"F","unit":"KGM","rubros":["MI"],"ai_keywords":["acido","sulfurico","h2so4","quimico","lixiviacion"],"aliases":["acido sulfurico","h2so4"]},
    {"code":"242-MM-MI-0001-F","name":"Mineral de cobre concentrado","cta":"242","gasto":"6022","nat":"MM","tk":"F","unit":"TON","rubros":["MI"],"ai_keywords":["mineral","cobre","concentrado","cu","mineria"],"aliases":["concentrado cobre","mineral cobre"]},
    # ── Construcción ───────────────────────────────────────────────────────
    {"code":"241-MC-CO-0001-F","name":"Cemento Portland Tipo I x 42.5kg","cta":"241","gasto":"6021","nat":"MC","tk":"F","unit":"BOL","rubros":["CO","FA","RE"],"ai_keywords":["cemento","portland","tipo i","42.5","saco","bolsa","cpo"],"aliases":["cemento portland","cemento tipo i"]},
    {"code":"241-MC-CO-0002-F","name":"Acero corrugado Grado 60 3/8\"","cta":"241","gasto":"6021","nat":"MC","tk":"F","unit":"BAR","rubros":["CO","FA"],"ai_keywords":["acero","fierro","3/8","corrugado","grado 60","barra"],"aliases":["fierro 3/8","acero 3/8","varilla corrugada"]},
    {"code":"241-MC-CO-0003-F","name":"Acero corrugado Grado 60 1/2\"","cta":"241","gasto":"6021","nat":"MC","tk":"F","unit":"BAR","rubros":["CO","FA"],"ai_keywords":["acero","fierro","1/2","corrugado","barra"],"aliases":["fierro 1/2","acero 1/2"]},
    {"code":"242-MC-CO-0001-F","name":"Arena gruesa de río (m³)","cta":"242","gasto":"6022","nat":"MC","tk":"F","unit":"M3","rubros":["CO"],"ai_keywords":["arena","gruesa","rio","construccion","m3","agregado fino"],"aliases":["arena gruesa","arena de rio"]},
    {"code":"242-MC-CO-0002-F","name":"Piedra chancada 3/4\" (m³)","cta":"242","gasto":"6022","nat":"MC","tk":"F","unit":"M3","rubros":["CO"],"ai_keywords":["piedra","chancada","3/4","agregado","grueso","m3"],"aliases":["piedra chancada","agregado grueso"]},
    {"code":"241-MC-CO-0004-F","name":"Ladrillo King Kong 18 huecos","cta":"241","gasto":"6021","nat":"MC","tk":"F","unit":"UND","rubros":["CO","RE"],"ai_keywords":["ladrillo","king kong","18 huecos","arcilla","lark"],"aliases":["ladrillo kk","ladrillo 18h"]},
    {"code":"202-ME-CO-0001-F","name":"Tubería PVC SAP 4\" desagüe x 3m","cta":"202","gasto":"6912","nat":"ME","tk":"F","unit":"UND","rubros":["CO","CM","RE"],"ai_keywords":["tubo","tuberia","pvc","4","desague","sap","nicoll"],"aliases":["tubo pvc 4","tuberia pvc desague"]},
    {"code":"202-ME-CO-0002-F","name":"Cable NYY 3x6mm² (m)","cta":"202","gasto":"6912","nat":"ME","tk":"F","unit":"MTR","rubros":["CO","CM","EN","RE"],"ai_keywords":["cable","nyy","conductor","electrico","3x6","indeco"],"aliases":["cable nyy","cable thw","conductor electrico"]},
    # ── Herramientas ───────────────────────────────────────────────────────
    {"code":"337-HT-CO-0001-T","name":"Mezcladora concreto 9P³ diesel","cta":"337","gasto":"6817","nat":"HT","tk":"T","unit":"UND","rubros":["CO","FA"],"ai_keywords":["mezcladora","concreto","hormigonera","diesel","9p","cipsa"],"aliases":["mezcladora concreto","hormigonera"]},
    {"code":"337-HT-CO-0002-T","name":"Vibrador de concreto c/manguera","cta":"337","gasto":"6817","nat":"HT","tk":"T","unit":"UND","rubros":["CO","FA"],"ai_keywords":["vibrador","concreto","aguja","manguera","electrico","makita"],"aliases":["vibrador concreto","aguja vibradora"]},
    {"code":"337-HE-GE-0001-P","name":"Amoladora angular 7\" 2200W","cta":"337","gasto":"6817","nat":"HE","tk":"P","unit":"UND","rubros":["GE","CO","FA","MI","EN"],"ai_keywords":["amoladora","angular","7","grinder","esmeril","bosch","dewalt"],"aliases":["amoladora 7","esmeril angular"]},
    {"code":"337-HE-GE-0002-P","name":"Taladro percutor 13mm SDS","cta":"337","gasto":"6817","nat":"HE","tk":"P","unit":"UND","rubros":["GE","CO","FA","MI","EN"],"ai_keywords":["taladro","percutor","sds","electrico","bosch","makita"],"aliases":["taladro percutor","taladro sds"]},
    # ── Fabricación ────────────────────────────────────────────────────────
    {"code":"241-MP-FA-0001-F","name":"Plancha de acero A36 1/4\" (kg)","cta":"241","gasto":"6021","nat":"MP","tk":"F","unit":"KGM","rubros":["FA","CO"],"ai_keywords":["plancha","acero","a36","lamina","1/4","estructural"],"aliases":["plancha acero","lamina acero a36"]},
    {"code":"241-MP-FA-0002-F","name":"PVC granulado natural (kg)","cta":"241","gasto":"6021","nat":"MP","tk":"F","unit":"KGM","rubros":["FA"],"ai_keywords":["pvc","granulo","resina","granza","polimero","plastico"],"aliases":["pvc granulo","resina pvc"]},
    {"code":"251-MA-FA-0001-F","name":"Soldadura electrodo 7018 (kg)","cta":"251","gasto":"6031","nat":"MA","tk":"F","unit":"KGM","rubros":["FA","CO","MI"],"ai_keywords":["soldadura","7018","electrodo","acero","punto azul"],"aliases":["soldadura 7018","electrodo 7018"]},
    {"code":"252-GA-FA-0001-F","name":"Oxígeno industrial (m³)","cta":"252","gasto":"6569","nat":"GA","tk":"F","unit":"M3","rubros":["FA","CO","MI"],"ai_keywords":["oxigeno","industrial","gas","cilindro","m3","soldadura"],"aliases":["oxigeno industrial","gas oxigeno"]},
    {"code":"261-EN-FA-0001-F","name":"Saco de polipropileno 50kg","cta":"261","gasto":"6411","nat":"EC","tk":"F","unit":"UND","rubros":["FA","DI","AG"],"ai_keywords":["saco","polipropileno","pp","envase","50kg"],"aliases":["saco pp","saco polipropileno"]},
    # ── Distribución ───────────────────────────────────────────────────────
    {"code":"202-ME-DI-0001-F","name":"Arroz extra blanco (saco 50kg)","cta":"202","gasto":"6912","nat":"MD","tk":"F","unit":"SAC","rubros":["DI","CM"],"ai_keywords":["arroz","blanco","extra","50kg","saco"],"aliases":["arroz blanco","arroz extra"]},
    {"code":"202-ME-DI-0002-F","name":"Azúcar rubia (saco 50kg)","cta":"202","gasto":"6912","nat":"MD","tk":"F","unit":"SAC","rubros":["DI","CM"],"ai_keywords":["azucar","rubia","50kg","saco"],"aliases":["azucar rubia","azucar saco"]},
    {"code":"253-RN-GE-0001-T","name":"Llanta 195/65R15 vehículo","cta":"253","gasto":"6531","nat":"RN","tk":"T","unit":"UND","rubros":["GE","DI","TR","CM"],"ai_keywords":["llanta","neumatico","goma","cubierta","195/65","r15"],"aliases":["llanta","neumatico","goma"]},
    # ── Activos Fijos ──────────────────────────────────────────────────────
    {"code":"334-VH-GE-0001-P","name":"Camioneta Pick-Up 4x4 diesel","cta":"334","gasto":"6814","nat":"VH","tk":"P","unit":"UND","rubros":["GE","MI","CO","FA","AG","TR","DI"],"ai_keywords":["camioneta","hilux","pickup","4x4","diesel","toyota","pick-up"],"aliases":["camioneta 4x4","hilux","pick-up diesel"]},
    {"code":"336-EQ-GE-0001-P","name":"Computadora escritorio Core i5","cta":"336","gasto":"6816","nat":"EQ","tk":"P","unit":"UND","rubros":["GE","MI","CO","FA","CM","DI","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["computadora","pc","desktop","escritorio","core i5"],"aliases":["pc escritorio","desktop","computadora oficina"]},
    {"code":"336-EQ-GE-0002-P","name":"Impresora multifuncional láser","cta":"336","gasto":"6816","nat":"EQ","tk":"P","unit":"UND","rubros":["GE","MI","CO","FA","CM","DI","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["impresora","laser","multifuncional","oficina","hp","epson"],"aliases":["impresora laser","multifuncional"]},
    {"code":"333-MQ-GE-0001-P","name":"Compresora de aire 100L 3HP","cta":"333","gasto":"6813","nat":"MQ","tk":"P","unit":"UND","rubros":["GE","CO","FA","MI","TR"],"ai_keywords":["compresora","aire","100l","3hp","industrial","schulz"],"aliases":["compresora aire","compresora 100l"]},
    {"code":"333-MQ-GE-0002-P","name":"Grupo electrógeno 15KVA diesel","cta":"333","gasto":"6813","nat":"MQ","tk":"P","unit":"UND","rubros":["GE","MI","CO","FA","TR","AG"],"ai_keywords":["generador","grupo electrogeno","15kva","diesel","planta electrica"],"aliases":["generador","grupo electrogeno"]},
    {"code":"335-MU-GE-0001-P","name":"Escritorio ejecutivo 1.60m","cta":"335","gasto":"6815","nat":"MU","tk":"P","unit":"UND","rubros":["GE","CM","DI","SA","HO","TE","RE","ED"],"ai_keywords":["escritorio","ejecutivo","oficina","mueble","1.60m"],"aliases":["escritorio","mueble oficina"]},
    # ── Repuestos ──────────────────────────────────────────────────────────
    {"code":"253-RM-GE-0001-T","name":"Filtro de aceite motor","cta":"253","gasto":"6531","nat":"RM","tk":"T","unit":"UND","rubros":["GE","TR","DI","MI","CO","FA"],"ai_keywords":["filtro","aceite","motor","oil","filter"],"aliases":["filtro aceite","filtro motor"]},
    {"code":"253-RM-GE-0002-T","name":"Pastillas de freno (juego)","cta":"253","gasto":"6531","nat":"RM","tk":"T","unit":"JGO","rubros":["GE","TR","DI","MI","CO"],"ai_keywords":["pastillas","freno","zapata","brake","pads"],"aliases":["pastillas freno","zapata freno"]},
    # ── Agropecuario ───────────────────────────────────────────────────────
    {"code":"252-AG-AG-0001-F","name":"Urea fertilizante granulado (kg)","cta":"252","gasto":"6569","nat":"AG","tk":"F","unit":"KGM","rubros":["AG"],"ai_keywords":["urea","fertilizante","nitrogeno","abono","granulado"],"aliases":["urea","fertilizante urea"]},
    {"code":"252-AG-AG-0002-F","name":"Fosfato diamónico DAP (saco)","cta":"252","gasto":"6569","nat":"AG","tk":"F","unit":"SAC","rubros":["AG"],"ai_keywords":["dap","fosfato","diamonico","fertilizante","fosfatado"],"aliases":["dap","fosfato diamonico"]},
    {"code":"252-AG-AG-0003-F","name":"Pesticida/Fungicida (litro)","cta":"252","gasto":"6569","nat":"AG","tk":"F","unit":"LTR","rubros":["AG"],"ai_keywords":["pesticida","fungicida","herbicida","plaguicida","litro"],"aliases":["pesticida","fungicida","herbicida"]},
    # ── Salud ──────────────────────────────────────────────────────────────
    {"code":"252-ME-SA-0001-F","name":"Paracetamol 500mg x 100 tab","cta":"252","gasto":"6569","nat":"ME","tk":"F","unit":"UND","rubros":["SA"],"ai_keywords":["paracetamol","acetaminofen","analgesico","tableta","500mg"],"aliases":["paracetamol","acetaminofen"]},
    {"code":"252-ME-SA-0002-F","name":"Guantes de látex médico (caja)","cta":"252","gasto":"6569","nat":"ME","tk":"F","unit":"CAJ","rubros":["SA"],"ai_keywords":["guantes","latex","medico","quirurgico","caja"],"aliases":["guantes latex","guantes medicos"]},
    # ── Hostelería ─────────────────────────────────────────────────────────
    {"code":"252-AL-HO-0001-F","name":"Aceite vegetal 20L bidón","cta":"252","gasto":"6569","nat":"AL","tk":"F","unit":"UND","rubros":["HO"],"ai_keywords":["aceite","vegetal","20l","bidon","cocinero"],"aliases":["aceite 20l","aceite cocinero"]},
    {"code":"252-AL-HO-0002-F","name":"Harina de trigo 50kg (saco)","cta":"252","gasto":"6569","nat":"AL","tk":"F","unit":"SAC","rubros":["HO","FA"],"ai_keywords":["harina","trigo","50kg","saco","pastelera"],"aliases":["harina trigo","harina 50kg"]},
    {"code":"252-CO-HO-0001-F","name":"Gas propano balón 10kg","cta":"252","gasto":"6562","nat":"CO","tk":"F","unit":"UND","rubros":["HO","FA","RE"],"ai_keywords":["gas","propano","balon","10kg","garrafa","cocina"],"aliases":["gas propano","balon gas"]},
    # ── Limpieza ───────────────────────────────────────────────────────────
    {"code":"252-LI-GE-0001-F","name":"Jabón líquido antibacterial (gl)","cta":"252","gasto":"6569","nat":"LI","tk":"F","unit":"GLN","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["jabon","liquido","antibacterial","limpieza","higiene","gallon"],"aliases":["jabon liquido","jabon industrial"]},
    {"code":"252-LI-GE-0002-F","name":"Papel higiénico industrial","cta":"252","gasto":"6569","nat":"LI","tk":"F","unit":"PAQ","rubros":["GE","MI","CO","FA","CM","DI","AG","SA","HO","TR","EN","TE","RE","ED"],"ai_keywords":["papel","higienico","bano","tissue","sanitario"],"aliases":["papel higienico","tissue","papel bano"]},
    # ── Tecnología ─────────────────────────────────────────────────────────
    {"code":"252-TI-GE-0001-F","name":"Disco SSD 1TB","cta":"252","gasto":"6561","nat":"TI","tk":"F","unit":"UND","rubros":["GE","TE","CM","FA","DI"],"ai_keywords":["disco","ssd","1tb","solido","unidad","almacenamiento"],"aliases":["ssd 1tb","disco solido"]},
    {"code":"252-TI-GE-0002-F","name":"Cable UTP cat6 (m)","cta":"252","gasto":"6561","nat":"TI","tk":"F","unit":"MTR","rubros":["GE","TE","CM","FA","DI","EN"],"ai_keywords":["cable","utp","cat6","red","ethernet","metro"],"aliases":["cable utp","cable red cat6"]},
]

# Enriquecer el catálogo con nombres de cuentas
def _enrich(item: dict) -> dict:
    item["cta_name"]   = PCGE_INVENTARIO.get(item["cta"], item["cta"])
    item["gasto_name"] = PCGE_GASTO.get(item["gasto"], item["gasto"])
    return item

MASTER_CATALOG = [_enrich(i) for i in MASTER_CATALOG]


# =========================================================================
# FUNCIÓN DE MATCHING IA
# =========================================================================

def match_catalog_item(description: str, account_code: str | None = None, rubro: str | None = None) -> dict | None:
    """
    Dado el texto de una línea de factura y opcionalmente la cuenta PCGE asignada por la IA,
    retorna el artículo del catálogo más probable.
    """
    desc = description.lower()
    # Prefijo de cuenta PCGE (3 dígitos)
    cta_prefix = (account_code or "")[:3]

    pool = MASTER_CATALOG
    if rubro:
        pool = [i for i in MASTER_CATALOG if rubro in i["rubros"] or "GE" in i["rubros"]]

    best: dict | None = None
    best_score = 0

    for item in pool:
        # Si hay cuenta PCGE, solo considerar ítems de esa cuenta
        if cta_prefix and item["cta"] != cta_prefix:
            continue

        score = 0
        for kw in (item.get("ai_keywords") or []):
            if kw in desc:
                score += 2
        for alias in (item.get("aliases") or []):
            if alias.lower() in desc:
                score += 3
        if item["name"].lower() in desc:
            score += 5

        if score > best_score:
            best_score = score
            best = item

    return best if best_score >= 2 else None


# =========================================================================
# PAYLOADS
# =========================================================================

class RubroSetupPayload(BaseModel):
    tenant_id: str
    rubros: list[str]   # ["MI","GE"] — rubro principal + secundarios


class AiMatchPayload(BaseModel):
    description: str
    account_code: str | None = None
    rubro: str | None = None


class AiMatchBatchPayload(BaseModel):
    items: list[dict]   # Lista de items de factura {"description":..., "account_code":...}
    rubro: str | None = None


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.get("/rubros")
async def list_rubros():
    """Retorna todos los rubros disponibles con su metadata."""
    return [{"code": k, "name": v} for k, v in RUBROS.items()]


@router.get("/items")
async def list_catalog_items(
    rubro: str | None = None,
    cta: str | None = None,
    nat: str | None = None,
    tk: str | None = None,
    search: str | None = None,
    limit: int = 500,
):
    """
    Lista artículos del catálogo con filtros opcionales.
    - rubro: filtrar por industria (GE, MI, CO, FA, CM, DI, AG, PE, SA, HO, TR, EN, TE, RE, ED)
    - cta: filtrar por cuenta PCGE de inventario (252, 241, 202...)
    - nat: filtrar por naturaleza (SU, MP, ME, HE...)
    - tk: filtrar por token (P, T, F)
    - search: búsqueda por nombre/alias
    """
    pool = MASTER_CATALOG

    if rubro:
        pool = [i for i in pool if rubro in i["rubros"] or "GE" in i["rubros"]]
    if cta:
        pool = [i for i in pool if i["cta"] == cta]
    if nat:
        pool = [i for i in pool if i["nat"] == nat]
    if tk:
        pool = [i for i in pool if i["tk"] == tk]
    if search:
        q = search.lower()
        pool = [i for i in pool if q in i["name"].lower()
                or any(q in a.lower() for a in (i.get("aliases") or []))
                or any(q in k.lower() for k in (i.get("ai_keywords") or []))]

    return pool[:limit]


@router.get("/items/{code}")
async def get_catalog_item(code: str):
    """Retorna un artículo específico del catálogo por código."""
    item = next((i for i in MASTER_CATALOG if i["code"] == code), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"Artículo {code} no encontrado en catálogo")
    return item


@router.get("/pcge/inventario")
async def get_pcge_inventario():
    """Retorna todas las cuentas PCGE de inventario."""
    return [{"code": k, "name": v} for k, v in PCGE_INVENTARIO.items()]


@router.get("/pcge/gasto")
async def get_pcge_gasto():
    """Retorna todas las cuentas PCGE de gasto."""
    return [{"code": k, "name": v} for k, v in PCGE_GASTO.items()]


@router.post("/ai/match")
async def ai_match_single(payload: AiMatchPayload):
    """
    Dado el texto de una línea de factura, retorna el artículo del catálogo más probable.
    Usado por la IA al leer facturas de compra.
    """
    match = match_catalog_item(payload.description, payload.account_code, payload.rubro)
    if not match:
        return {"matched": False, "item": None, "confidence": 0}
    # Calcular confianza simple
    desc = payload.description.lower()
    hits = sum(1 for kw in (match.get("ai_keywords") or []) if kw in desc)
    confidence = min(0.99, 0.5 + (hits * 0.1))
    return {"matched": True, "item": match, "confidence": round(confidence, 2)}


@router.post("/ai/match-batch")
async def ai_match_batch(payload: AiMatchBatchPayload):
    """
    Procesa en lote todos los ítems de una factura y asigna código de catálogo a cada uno.
    Retorna la lista enriquecida para el checklist de validación.
    """
    results = []
    for item in payload.items:
        desc = item.get("description", "")
        acc  = item.get("account_code", "")
        match = match_catalog_item(desc, acc, payload.rubro)

        desc_l = desc.lower()
        confidence = 0.0
        if match:
            hits = sum(1 for kw in (match.get("ai_keywords") or []) if kw in desc_l)
            confidence = min(0.99, 0.5 + (hits * 0.1))

        results.append({
            **item,
            "catalog_code":    match["code"]     if match else None,
            "catalog_name":    match["name"]     if match else None,
            "cta":             match["cta"]      if match else (acc[:3] or "252"),
            "cta_name":        match["cta_name"] if match else PCGE_INVENTARIO.get(acc[:3], "Suministros"),
            "gasto":           match["gasto"]    if match else "6569",
            "gasto_name":      match["gasto_name"] if match else "Suministros diversos",
            "nat":             match["nat"]      if match else "SU",
            "tk":              match["tk"]       if match else "F",
            "unit":            match["unit"]     if match else item.get("unit", "UND"),
            "catalog_matched": match is not None,
            "ai_confidence":   confidence,
        })
    return results


@router.post("/tenant/setup-rubros")
async def setup_tenant_rubros(payload: RubroSetupPayload, ctx=Depends(get_current_context)):
    """
    Configura el rubro principal de la empresa.
    Retorna el subconjunto del catálogo aplicable.
    """
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    # Filtrar catálogo para los rubros seleccionados
    catalog = [i for i in MASTER_CATALOG
               if any(r in i["rubros"] or "GE" in i["rubros"] for r in payload.rubros)]

    return {
        "tenant_id": payload.tenant_id,
        "rubros": payload.rubros,
        "catalog_count": len(catalog),
        "catalog": catalog,
    }
