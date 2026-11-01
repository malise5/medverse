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
  steps: PathwayStep[];
}

export const PATHWAYS: Pathway[] = [
  {
    id: "vision",
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
    title: "Feeling touch on the right hand",
    summary: "Fine touch ascends to the left somatosensory cortex.",
    steps: [
      { label: "Spinal cord (dorsal columns)", structures: ["FMA:7647"], note: "Fine-touch fibres ascend on the same side in the dorsal columns." },
      { label: "Medulla oblongata (dorsal column nuclei)", structures: ["FMA:62004"], note: "They synapse in the gracile and cuneate nuclei; the next fibres cross as the medial lemniscus." },
      { label: "Thalamus (ventral posterolateral nucleus)", structures: ["FMA:258716", "FMA:258714"], note: "The medial lemniscus relays in the thalamus." },
      { label: "Parietal lobe (primary somatosensory cortex)", structures: ["FMA:72974", "FMA:72973"], note: "The postcentral gyrus localises and identifies the touch." },
    ],
  },
];

/** Seconds per pathway step at 1× speed. */
export const STEP_SECONDS = 1.8;
