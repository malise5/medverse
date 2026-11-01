/**
 * Neural pathways through structures of the 3D head, in anatomical order. Each step
 * names one or more candidate structures (the first present in the body on screen is
 * used). Notes describe what happens at the step; sources: Gray's Anatomy (42nd ed.),
 * Moore's Clinically Oriented Anatomy (8th ed.), Guyton & Hall (14th ed.).
 */

export interface PathwayStep {
  label: string;
  structures: string[];
  note: string;
}

export interface Pathway {
  id: string;
  title: string;
  summary: string;
  /** Study region whose processes panel offers the pathway. */
  region: "head" | "neck";
  /** Layers shown while it plays (default: brain and cranial nerves, faint skull). */
  view?: {
    systems: string[];
    opacity?: Record<string, number>;
    /** Structures to frame; ignored when a camera direction is given. */
    focus?: string[];
    /** View the region from this side instead (e.g. "left" for the pharynx in profile). */
    camera?: "anterior" | "left" | "right";
  };
  steps: PathwayStep[];
}

export const PATHWAYS: Pathway[] = [
  {
    id: "vision",
    region: "head",
    title: "Seeing",
    summary: "Light on the right retina reaches the visual cortex.",
    steps: [
      { label: "Retina (right eye)", structures: ["FMA:12514"], note: "Photoreceptors convert light into electrical signals; retinal ganglion cells send them out of the eye." },
      { label: "Optic nerve", structures: ["FMA:50875"], note: "Ganglion-cell axons leave the orbit through the optic canal." },
      { label: "Optic chiasm", structures: ["FMA:62045"], note: "Fibres from the nasal half of each retina cross, so each side of the brain receives the opposite half of the visual field." },
      { label: "Optic tract", structures: ["FMA:67936"], note: "Beyond the chiasm, each optic tract carries the opposite half of the visual field from both eyes." },
      { label: "Lateral geniculate body (thalamus)", structures: ["FMA:73304", "FMA:258716", "FMA:258714"], note: "The optic tract relays in the lateral geniculate nucleus of the thalamus." },
      { label: "Occipital lobe (primary visual cortex)", structures: ["FMA:72976", "FMA:72975"], note: "The optic radiation reaches the primary visual cortex along the calcarine sulcus, where the image is analysed." },
    ],
  },
  {
    id: "hearing",
    region: "head",
    title: "Hearing",
    summary: "Sound vibrations in the inner ear reach the auditory cortex.",
    steps: [
      { label: "Middle ear ossicles", structures: ["FMA:52753", "FMA:52751"], note: "The tympanic membrane, malleus, incus and stapes amplify vibrations and pass them to the oval window." },
      { label: "Cochlea (bony labyrinth)", structures: ["FMA:60179"], note: "Hair cells in the cochlea convert fluid waves into nerve impulses, different frequencies at different places." },
      { label: "Cochlear nerve", structures: ["FMA:53431"], note: "The auditory part of the vestibulocochlear nerve enters the brainstem." },
      { label: "Brainstem (cochlear nuclei, superior olive)", structures: ["FMA:67943", "FMA:62004"], note: "Signals relay in the cochlear nuclei and cross to both sides, allowing sound localisation." },
      { label: "Midbrain (inferior colliculus)", structures: ["FMA:61993"], note: "Auditory information is integrated in the inferior colliculus." },
      { label: "Medial geniculate body (thalamus)", structures: ["FMA:73309", "FMA:258714", "FMA:258716"], note: "The medial geniculate nucleus of the thalamus relays to the auditory cortex." },
      { label: "Temporal lobe (primary auditory cortex)", structures: ["FMA:72971", "FMA:72972"], note: "The primary auditory cortex on the superior temporal gyrus perceives pitch and loudness." },
    ],
  },
  {
    id: "movement",
    region: "head",
    title: "Moving the right hand",
    summary: "A command from the left motor cortex descends to the spinal cord.",
    steps: [
      { label: "Frontal lobe (left primary motor cortex)", structures: ["FMA:72970"], note: "Upper motor neurons in the precentral gyrus initiate voluntary movement of the opposite side." },
      { label: "Midbrain (cerebral peduncle)", structures: ["FMA:61993"], note: "The corticospinal fibres descend through the internal capsule and cerebral peduncle." },
      { label: "Pons", structures: ["FMA:67943"], note: "They pass through the basilar part of the pons." },
      { label: "Medulla oblongata (pyramidal decussation)", structures: ["FMA:62004"], note: "About 85–90 % of fibres cross to the opposite side in the pyramidal decussation." },
      { label: "Spinal cord", structures: ["FMA:7647"], note: "The lateral corticospinal tract descends to lower motor neurons that drive the muscles." },
    ],
  },
  {
    id: "touch",
    region: "head",
    title: "Feeling touch on the right hand",
    summary: "Fine touch ascends to the left somatosensory cortex.",
    steps: [
      { label: "Spinal cord (dorsal columns)", structures: ["FMA:7647"], note: "Fine-touch fibres ascend on the same side in the dorsal columns." },
      { label: "Medulla oblongata (dorsal column nuclei)", structures: ["FMA:62004"], note: "They synapse in the gracile and cuneate nuclei; the next fibres cross as the medial lemniscus." },
      { label: "Thalamus (ventral posterolateral nucleus)", structures: ["FMA:258716", "FMA:258714"], note: "The medial lemniscus relays in the thalamus." },
      { label: "Parietal lobe (primary somatosensory cortex)", structures: ["FMA:72974", "FMA:72973"], note: "The postcentral gyrus localises and identifies the touch." },
    ],
  },
  // ------------------------------------------------------------------ neck
  {
    id: "swallowing",
    region: "neck",
    title: "Swallowing",
    summary: "A bolus passes from the mouth through the pharynx into the oesophagus.",
    view: {
      systems: ["digestive", "muscular", "respiratory", "skeletal"],
      opacity: { skeletal: 0.2, muscular: 0.3, digestive: 0.8 },
      camera: "left",
    },
    steps: [
      { label: "Oral phase: tongue", structures: ["FMA:54640"], note: "Voluntary: the tongue presses the bolus up and back against the hard palate into the oropharynx." },
      { label: "Soft palate rises", structures: ["FMA:55021", "FMA:55022"], note: "The soft palate and uvula elevate and seal off the nasopharynx so food cannot enter the nose. From here swallowing is a reflex coordinated by the brainstem (CN V, IX, X, XII)." },
      { label: "Hyoid and larynx elevate", structures: ["FMA:52749", "FMA:55099", "FMA:46321"], note: "Suprahyoid muscles pull the hyoid and larynx up and forward; the epiglottis tilts over the laryngeal inlet and the vocal folds close, protecting the airway." },
      { label: "Pharyngeal constrictors", structures: ["FMA:46631", "FMA:46633", "FMA:46635", "FMA:46636"], note: "The superior, middle and inferior constrictors contract in sequence, squeezing the bolus downward; the pharyngeal phase lasts about one second." },
      { label: "Upper oesophageal sphincter opens", structures: ["FMA:54880", "FMA:46635"], note: "The cricopharyngeal part of the inferior constrictor relaxes and the bolus enters the oesophagus." },
      { label: "Oesophageal peristalsis", structures: ["FMA:7131"], note: "A peristaltic wave (about 2–4 cm/s) carries the bolus to the stomach in roughly 8–10 seconds." },
    ],
  },
  {
    id: "baroreflex",
    region: "neck",
    title: "Baroreceptor reflex",
    summary: "A rise in blood pressure is sensed in the carotid sinus and slows the heart.",
    view: {
      systems: ["cardiovascular", "nervous", "skeletal"],
      opacity: { skeletal: 0.15, cardiovascular: 0.7 },
      focus: ["FMA:3941"],
    },
    steps: [
      { label: "Carotid sinus stretches", structures: ["FMA:3949", "FMA:3941"], note: "Baroreceptors in the wall of the carotid sinus, at the start of the internal carotid artery, fire faster as arterial pressure stretches the wall." },
      { label: "Glossopharyngeal nerve", structures: ["FMA:50892", "FMA:50894"], note: "Impulses travel in the carotid sinus branch of CN IX to the brainstem (aortic arch receptors use the vagus)." },
      { label: "Nucleus of the solitary tract", structures: ["FMA:256691", "FMA:62004"], note: "The medullary cardiovascular centre integrates the signal: parasympathetic output rises and sympathetic output falls." },
      { label: "Vagus nerve", structures: ["FMA:6219", "FMA:6220"], note: "Vagal fibres descend in the carotid sheath to the cardiac plexus." },
      { label: "Heart slows", structures: ["FMA:7088"], note: "Heart rate and contractility fall and vessels dilate, bringing blood pressure back toward its set point within a few heartbeats." },
    ],
  },
  {
    id: "airflow",
    region: "neck",
    title: "Breathing in",
    summary: "Inhaled air passes the nose, pharynx and larynx into the trachea.",
    view: {
      systems: ["respiratory", "skeletal"],
      opacity: { skeletal: 0.2 },
      camera: "left",
    },
    steps: [
      { label: "Nasal cavity", structures: ["FMA:59684"], note: "Air is warmed, moistened and filtered by the vascular, mucus-covered nasal mucosa." },
      { label: "Nasopharynx", structures: ["FMA:54878"], note: "Air passes behind the soft palate; the pharyngotympanic tubes open here." },
      { label: "Oropharynx and laryngopharynx", structures: ["FMA:54879", "FMA:54880"], note: "Air and food share this passage; the airway continues forward into the larynx." },
      { label: "Larynx", structures: ["FMA:55099", "FMA:9615"], note: "The posterior crico-arytenoid muscles abduct the vocal folds, widening the glottis during inspiration." },
      { label: "Trachea", structures: ["FMA:7394"], note: "C-shaped cartilage rings keep the trachea open as air flows down to the main bronchi." },
      { label: "Main bronchi", structures: ["FMA:7395", "FMA:7396"], note: "The trachea divides at the carina (about the level of T4–T5) into the right and left main bronchi." },
    ],
  },
  {
    id: "voice",
    region: "neck",
    title: "Speaking",
    summary: "Air from the lungs sets the vocal folds vibrating; the throat and mouth shape the sound.",
    view: {
      systems: ["respiratory", "muscular", "skeletal", "nervous"],
      opacity: { skeletal: 0.3, muscular: 0.35 },
      camera: "left",
    },
    steps: [
      { label: "Air from the lungs", structures: ["FMA:7394"], note: "Exhaled air builds pressure below the closed glottis." },
      { label: "Vocal folds close", structures: ["FMA:46580", "FMA:46589"], note: "The lateral crico-arytenoid and arytenoid muscles adduct the vocal folds (innervation: recurrent laryngeal branch of the vagus)." },
      { label: "Pitch: cricothyroid", structures: ["FMA:46609"], note: "Cricothyroid tilts the thyroid cartilage forward, lengthening and tensing the folds to raise pitch (external branch of the superior laryngeal nerve)." },
      { label: "Vocal folds vibrate", structures: ["FMA:55245", "FMA:46592"], note: "Air pressure blows the folds apart and elastic recoil closes them again, typically about 100–250 times per second in speech." },
      { label: "Articulation", structures: ["FMA:54640", "FMA:55021"], note: "The pharynx, soft palate, tongue and lips filter and shape the sound into vowels and consonants." },
    ],
  },
];

/** Seconds per pathway step at 1× speed. */
export const STEP_SECONDS = 1.8;
