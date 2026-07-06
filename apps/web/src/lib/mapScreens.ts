import arBaggage from "../assets/maps/screens/ar_baggage.png";
import arPoolDay from "../assets/maps/screens/ar_pool_day.png";
import arShoots from "../assets/maps/screens/ar_shoots.png";
import csAgency from "../assets/maps/screens/cs_agency.png";
import csAlpine from "../assets/maps/screens/cs_alpine.png";
import csItaly from "../assets/maps/screens/cs_italy.png";
import csOffice from "../assets/maps/screens/cs_office.png";
import deAncient from "../assets/maps/screens/de_ancient.png";
import deAnubis from "../assets/maps/screens/de_anubis.png";
import deBasalt from "../assets/maps/screens/de_basalt.png";
import deBrewery from "../assets/maps/screens/de_brewery.png";
import deCache from "../assets/maps/screens/de_cache.png";
import deDogtown from "../assets/maps/screens/de_dogtown.png";
import deDust2 from "../assets/maps/screens/de_dust2.png";
import deEdin from "../assets/maps/screens/de_edin.png";
import deGolden from "../assets/maps/screens/de_golden.png";
import deGrail from "../assets/maps/screens/de_grail.png";
import deInferno from "../assets/maps/screens/de_inferno.png";
import deJura from "../assets/maps/screens/de_jura.png";
import deMills from "../assets/maps/screens/de_mills.png";
import deMirage from "../assets/maps/screens/de_mirage.png";
import deNuke from "../assets/maps/screens/de_nuke.png";
import deOverpass from "../assets/maps/screens/de_overpass.png";
import dePalacio from "../assets/maps/screens/de_palacio.png";
import dePoseidon from "../assets/maps/screens/de_poseidon.png";
import deRooftop from "../assets/maps/screens/de_rooftop.png";
import deSanctum from "../assets/maps/screens/de_sanctum.png";
import deStronghold from "../assets/maps/screens/de_stronghold.png";
import deThera from "../assets/maps/screens/de_thera.png";
import deTrain from "../assets/maps/screens/de_train.png";
import deVertigo from "../assets/maps/screens/de_vertigo.png";

/** Screenshot par map (id Faceit → asset). `undefined` si pas de screen pour cette map. */
const SCREENS: Record<string, string> = {
  ar_baggage: arBaggage,
  ar_pool_day: arPoolDay,
  ar_shoots: arShoots,
  cs_agency: csAgency,
  cs_alpine: csAlpine,
  cs_italy: csItaly,
  cs_office: csOffice,
  de_ancient: deAncient,
  de_anubis: deAnubis,
  de_basalt: deBasalt,
  de_brewery: deBrewery,
  de_cache: deCache,
  de_dogtown: deDogtown,
  de_dust2: deDust2,
  de_edin: deEdin,
  de_golden: deGolden,
  de_grail: deGrail,
  de_inferno: deInferno,
  de_jura: deJura,
  de_mills: deMills,
  de_mirage: deMirage,
  de_nuke: deNuke,
  de_overpass: deOverpass,
  de_palacio: dePalacio,
  de_poseidon: dePoseidon,
  de_rooftop: deRooftop,
  de_sanctum: deSanctum,
  de_stronghold: deStronghold,
  de_thera: deThera,
  de_train: deTrain,
  de_vertigo: deVertigo,
};

export function mapScreen(map: string): string | undefined {
  return SCREENS[map];
}
