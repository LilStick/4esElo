import { TbMap2 } from "react-icons/tb";
import arBaggage from "../assets/maps/ar_baggage.svg";
import arShoots from "../assets/maps/ar_shoots.svg";
import csItaly from "../assets/maps/cs_italy.svg";
import csOffice from "../assets/maps/cs_office.svg";
import deAncient from "../assets/maps/de_ancient.svg";
import deAnubis from "../assets/maps/de_anubis.svg";
import deDust from "../assets/maps/de_dust.svg";
import deDust2 from "../assets/maps/de_dust2.svg";
import deInferno from "../assets/maps/de_inferno.svg";
import deMirage from "../assets/maps/de_mirage.svg";
import deNuke from "../assets/maps/de_nuke.svg";
import deOverpass from "../assets/maps/de_overpass.svg";
import deTrain from "../assets/maps/de_train.svg";
import deVertigo from "../assets/maps/de_vertigo.svg";
import deCache from "../assets/maps/de_cache.png";

/** Icône officielle par map (id Faceit → asset). Repli sur une icône générique si inconnue. */
const MAPS: Record<string, string> = {
  ar_baggage: arBaggage,
  ar_shoots: arShoots,
  cs_italy: csItaly,
  cs_office: csOffice,
  de_ancient: deAncient,
  de_anubis: deAnubis,
  de_dust: deDust,
  de_dust2: deDust2,
  de_inferno: deInferno,
  de_mirage: deMirage,
  de_nuke: deNuke,
  de_overpass: deOverpass,
  de_train: deTrain,
  de_vertigo: deVertigo,
  de_cache: deCache,
};

export function MapIcon({ map, size = 24 }: { map: string; size?: number }) {
  const src = MAPS[map];
  if (!src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] text-ink-faint"
        style={{ width: size, height: size }}
        title={map}
      >
        <TbMap2 size={size * 0.6} />
      </span>
    );
  }
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      title={map}
      className="shrink-0 rounded-md"
      draggable={false}
    />
  );
}
