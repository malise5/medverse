/**
 * Kiswahili text for the living processes and pathways (processes.ts, pathways.ts).
 * Structure ids, order and timing stay in the English source; only wording is here, and
 * steps are matched by position. DRAFT: pending review by Swahili-speaking health
 * professionals.
 */

import type { ProcessId } from "./processes";

export interface ProcessText {
  title: string;
  summary: string;
  breadcrumb: string[];
  basis: string;
}

export interface PathwayText {
  title: string;
  summary: string;
  steps: { label: string; note: string }[];
}

export const PROCESSES_SW: Record<ProcessId, ProcessText> = {
  signalling: {
    title: "Neuroni zikiwasiliana",
    summary: "Washa neuroni, tazama misukumo ikisafiri kwenye aksoni na kemikali za kupitisha ishara zikivuka sinapsi.",
    breadcrumb: ["Kichwa", "Ubongo", "Gamba la ubongo"],
    basis:
      "Modeli: neuroni za kukusanya-na-kufyatua (pumziko −70 mV, kizingiti −55 mV, τm ms 10, kipindi cha kutoitikia ms 2) zenye upitishaji wa aksoni (zenye mielini m/s 20, zisizo na mielini m/s 0.5), ucheleweshaji wa sinapsi wa ms 0.5 na EPSP/IPSP zinazojumlishwa. Umbo la msukumo ni kutoka modeli ya Hodgkin–Huxley. Imeonyeshwa kwa mwendo wa polepole; umbo la seli ni la kimchoro.",
  },
  growth: {
    title: "Neuroni zikikua na kuungana",
    summary: "Ncha za ukuaji husonga mbele, aksoni huongozwa kwenye malengo, sinapsi huundwa na baadhi huondolewa.",
    breadcrumb: ["Kichwa", "Ubongo", "Gamba la ubongo linalokua"],
    basis:
      "Makadirio ya kielimu ya ukuaji: ncha za ukuaji husonga kwa uthabiti, kwa uongozi wa kemikali zinazovutia na kwa uchunguzi wa nasibu; kichipukizi kimoja huwa aksoni; sinapsi huundwa zinapogusana na karibu theluthi moja huondolewa. Miezi ya ukuaji imebanwa kuwa sekunde.",
  },
  blood: {
    title: "Mtiririko wa damu kichwani na shingoni",
    summary: "Seli nyekundu hutiririka kupitia ateri na vena za kichwa na ubongo.",
    breadcrumb: ["Kichwa", "Mishipa ya damu"],
    basis:
      "Seli husogea kando ya mistari ya katikati ya modeli za 3D za mishipa. Mwelekeo umekadiriwa kutoka umbo (ateri hubeba damu kutoka moyoni, vena kuelekea moyoni); kasi ni ya kielelezo na imepunguzwa. Nyekundu angavu: damu ya ateri yenye oksijeni nyingi; nyekundu-bluu iliyokolea: damu ya vena yenye oksijeni kidogo.",
  },
  pathways: {
    title: "Njia zikifanya kazi",
    summary:
      "Fuatilia kuona, kusikia, kusogea, kuhisi mguso, kumeza, kupumua na reflexi ya baroreseptari kupitia miundo halisi inayohusika.",
    breadcrumb: ["Kichwa na shingo"],
    basis:
      "Kila njia huwasha miundo inayohusika kwa mpangilio wake wa kianatomia, msukumo ukisafiri kati yake; maelezo yanatoa muda na viwango vya kawaida kutoka vitabu vya kiada. Njia kati ya miundo zimechorwa kimchoro (tao zilizonyooka), na muda umepunguzwa kasi na haulingani na uhalisia.",
  },
};

export const PATHWAYS_SW: Record<string, PathwayText> = {
  vision: {
    title: "Kuona",
    summary: "Mwanga kwenye retina ya kulia hufika kwenye gamba la kuona.",
    steps: [
      { label: "Retina (jicho la kulia)", note: "Vipokezi vya mwanga hubadilisha mwanga kuwa ishara za umeme; seli za ganglioni za retina huzituma nje ya jicho." },
      { label: "Neva ya kuona", note: "Aksoni za seli za ganglioni hutoka kwenye obiti kupitia mfereji wa neva ya kuona." },
      { label: "Kiasma ya neva za kuona", note: "Nyuzi kutoka nusu ya upande wa pua ya kila retina huvukana, hivyo kila upande wa ubongo hupokea nusu ya kinyume ya uwanja wa kuona." },
      { label: "Njia ya kuona (optic tract)", note: "Baada ya kiasma, kila njia ya kuona hubeba nusu ya kinyume ya uwanja wa kuona kutoka macho yote mawili." },
      { label: "Kiini cha jenikulati cha pembeni (thalamasi)", note: "Njia ya kuona hupokezana ishara kwenye kiini cha jenikulati cha pembeni cha thalamasi." },
      { label: "Ndewe ya oksipitali (gamba la msingi la kuona)", note: "Mnururisho wa kuona hufika kwenye gamba la msingi la kuona kando ya mfereji wa kalkarini, ambapo picha huchambuliwa." },
    ],
  },
  hearing: {
    title: "Kusikia",
    summary: "Mitetemo ya sauti katika sikio la ndani hufika kwenye gamba la kusikia.",
    steps: [
      { label: "Vifupa vya sikio la kati", note: "Kiwambo cha sikio, maleasi, inkasi na stapisi hukuza mitetemo na kuipeleka kwenye dirisha la oval." },
      { label: "Koklea (labirinthi ya mfupa)", note: "Seli zenye vinywele kwenye koklea hubadilisha mawimbi ya kiowevu kuwa misukumo ya neva, masafa tofauti mahali tofauti." },
      { label: "Neva ya koklea", note: "Sehemu ya kusikia ya neva ya vestibulokoklea huingia kwenye shina la ubongo." },
      { label: "Shina la ubongo (viini vya koklea, oliva ya juu)", note: "Ishara hupokezana kwenye viini vya koklea na kuvuka kwenda pande zote mbili, hivyo kuwezesha kutambua sauti inakotoka." },
      { label: "Ubongo wa kati (kolikulasi ya chini)", note: "Taarifa za kusikia huunganishwa kwenye kolikulasi ya chini." },
      { label: "Kiini cha jenikulati cha kati (thalamasi)", note: "Kiini cha jenikulati cha kati cha thalamasi hupeleka ishara kwenye gamba la kusikia." },
      { label: "Ndewe ya temporali (gamba la msingi la kusikia)", note: "Gamba la msingi la kusikia kwenye gyrus ya juu ya temporali hutambua kina na ukubwa wa sauti." },
    ],
  },
  movement: {
    title: "Kusogeza mkono wa kulia",
    summary: "Amri kutoka gamba la mwendo la kushoto hushuka hadi kamba ya uti wa mgongo.",
    steps: [
      { label: "Ndewe ya mbele (gamba la msingi la mwendo la kushoto)", note: "Neuroni za juu za mwendo kwenye gyrus ya kabla ya kati huanzisha mwendo wa hiari wa upande wa kinyume." },
      { label: "Ubongo wa kati (pedunkulo ya ubongo)", note: "Nyuzi za kortikospinali hushuka kupitia kapsuli ya ndani na pedunkulo ya ubongo." },
      { label: "Ponsi", note: "Hupita kwenye sehemu ya msingi ya ponsi." },
      { label: "Medula oblongata (mvukano wa piramidi)", note: "Takriban 85–90 % ya nyuzi huvuka kwenda upande wa kinyume kwenye mvukano wa piramidi." },
      { label: "Kamba ya uti wa mgongo", note: "Njia ya kortikospinali ya pembeni hushuka hadi neuroni za chini za mwendo zinazoendesha misuli." },
    ],
  },
  touch: {
    title: "Kuhisi mguso kwenye mkono wa kulia",
    summary: "Mguso mwepesi hupanda hadi gamba la hisia za mwili la kushoto.",
    steps: [
      { label: "Kamba ya uti wa mgongo (nguzo za nyuma)", note: "Nyuzi za mguso mwepesi hupanda upande uleule kwenye nguzo za nyuma." },
      { label: "Medula oblongata (viini vya nguzo za nyuma)", note: "Huungana kwenye viini vya grasili na kuneati; nyuzi zinazofuata huvuka kama lemniskasi ya kati." },
      { label: "Thalamasi (kiini cha nyuma-pembeni cha tumbo)", note: "Lemniskasi ya kati hupokezana ishara kwenye thalamasi." },
      { label: "Ndewe ya parietali (gamba la msingi la hisia za mwili)", note: "Gyrus ya baada ya kati hutambua mahali na aina ya mguso." },
    ],
  },
  swallowing: {
    title: "Kumeza",
    summary: "Tonge hupita kutoka kinywani kupitia koromeo hadi kwenye umio.",
    steps: [
      { label: "Hatua ya kinywa: ulimi", note: "Kwa hiari: ulimi husukuma tonge juu na nyuma dhidi ya kaakaa gumu kuingia orofarinksi." },
      { label: "Kaakaa laini hupanda", note: "Kaakaa laini na kidakatonge hupanda na kufunga nasofarinksi ili chakula kisiingie puani. Kuanzia hapa kumeza ni reflexi inayoratibiwa na shina la ubongo (CN V, IX, X, XII)." },
      { label: "Haioidi na zoloto hupanda", note: "Misuli ya juu ya haioidi huvuta haioidi na zoloto juu na mbele; epiglotisi huinama juu ya mlango wa zoloto na nyuzi za sauti hufunga, hivyo kulinda njia ya hewa." },
      { label: "Misuli ya kubana koromeo", note: "Misuli ya juu, ya kati na ya chini ya kubana husinyaa kwa mfuatano, ikibana tonge kuelekea chini; hatua ya koromeo huchukua takriban sekunde moja." },
      { label: "Mlango wa juu wa umio hufunguka", note: "Sehemu ya krikofarinjia ya msuli wa chini wa kubana hutulia na tonge huingia kwenye umio." },
      { label: "Mawimbi ya peristalsi ya umio", note: "Wimbi la peristalsi (takriban cm 2–4 kwa sekunde) hubeba tonge hadi tumboni kwa takriban sekunde 8–10." },
    ],
  },
  baroreflex: {
    title: "Reflexi ya baroreseptari",
    summary: "Kupanda kwa shinikizo la damu huhisiwa kwenye sinasi ya karotidi na kupunguza kasi ya moyo.",
    steps: [
      { label: "Sinasi ya karotidi hutanuka", note: "Baroreseptari kwenye ukuta wa sinasi ya karotidi, mwanzoni mwa ateri ya karotidi ya ndani, hufyatua haraka zaidi shinikizo la ateri linapotanua ukuta." },
      { label: "Neva ya glosofarinjia", note: "Misukumo husafiri kwenye tawi la sinasi ya karotidi la CN IX hadi shina la ubongo (vipokezi vya tao la aota hutumia vagasi)." },
      { label: "Kiini cha njia ya solitari", note: "Kituo cha moyo na mishipa cha medula huunganisha ishara: utoaji wa parasimpathetiki huongezeka na wa simpathetiki hupungua." },
      { label: "Neva ya vagasi", note: "Nyuzi za vagasi hushuka ndani ya ala ya karotidi hadi fungu la neva la moyo." },
      { label: "Moyo hupunguza kasi", note: "Mapigo ya moyo na nguvu ya kusinyaa hupungua na mishipa hupanuka, na kurudisha shinikizo la damu karibu na kiwango chake ndani ya mapigo machache ya moyo." },
    ],
  },
  airflow: {
    title: "Kuvuta pumzi",
    summary: "Hewa inayovutwa hupita puani, kooni na kwenye zoloto hadi trakea.",
    steps: [
      { label: "Tundu la pua", note: "Hewa hupashwa joto, hulowanishwa na kuchujwa na utando wa pua wenye mishipa mingi ya damu na kamasi." },
      { label: "Nasofarinksi", note: "Hewa hupita nyuma ya kaakaa laini; mirija ya farinjotimpani hufunguka hapa." },
      { label: "Orofarinksi na laringofarinksi", note: "Hewa na chakula hushiriki njia hii; njia ya hewa huendelea mbele kuingia zoloto." },
      { label: "Zoloto", note: "Misuli ya nyuma ya kriko-aritenoidi hutanua nyuzi za sauti, na kupanua glotisi wakati wa kuvuta pumzi." },
      { label: "Trakea", note: "Pete za gegedu zenye umbo la C huweka trakea wazi hewa inapotiririka kushuka hadi bronkasi kuu." },
      { label: "Bronkasi kuu", note: "Trakea hugawanyika kwenye karina (takriban usawa wa T4–T5) kuwa bronkasi kuu ya kulia na ya kushoto." },
    ],
  },
  voice: {
    title: "Kuzungumza",
    summary: "Hewa kutoka mapafuni hutetemesha nyuzi za sauti; koo na kinywa huunda sauti.",
    steps: [
      { label: "Hewa kutoka mapafuni", note: "Hewa inayotolewa hujenga shinikizo chini ya glotisi iliyofungwa." },
      { label: "Nyuzi za sauti hufunga", note: "Misuli ya kriko-aritenoidi ya pembeni na aritenoidi hufunga nyuzi za sauti (neva: tawi la rekarenti la zoloto la vagasi)." },
      { label: "Kina cha sauti: krikothairoidi", note: "Krikothairoidi huinamisha gegedu ya thairoidi mbele, ikirefusha na kukaza nyuzi ili kupandisha kina cha sauti (tawi la nje la neva ya juu ya zoloto)." },
      { label: "Nyuzi za sauti hutetemeka", note: "Shinikizo la hewa husukuma nyuzi ziachane na unyumbufu huzifunga tena, kwa kawaida takriban mara 100–250 kwa sekunde wakati wa kuzungumza." },
      { label: "Utamkaji", note: "Koromeo, kaakaa laini, ulimi na midomo huchuja na kuunda sauti kuwa irabu na konsonanti." },
    ],
  },
};
