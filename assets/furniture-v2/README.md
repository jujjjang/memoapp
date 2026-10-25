# Airy furniture assets

Generated with the built-in image generation tool using the approved attic as the style reference. Original generated PNGs remain intact; these WebP files are delivery encodings. Silhouette clips in `FURNITURE_ART` exclude surrounding glow and stray pixels at render time.

Shared art direction: softly painted 2.5D storybook furniture, pale biscuit oak `#D7B992`, warm ivory `#F5ECDD`, low saturation and shallow matte shading. Transparent backdrop, no room, cast shadow, outer halo, labels, or text.

Final prompt set:

- **Writing desk:** a compact one-person desk, nearly straight-on elevation, thin tabletop and apron, tall slender outer legs, small ivory handle. The full silhouette should be about 1.5–1.8 times as wide as tall. Bare tabletop. Use only the approved attic as a palette/style reference.
- **Drawer cabinet:** three equal cream drawer fronts with genuinely round wooden knobs, a thin pale-oak frame and short tapered feet. Keep a naturally tall chest silhouette and gentle, low-contrast shading.
- **Clothes rail:** an empty narrow pale wooden rack with thin posts, a rounded bar, small foot blocks, low slatted shelf, and a cream tote resting on the shelf. No hangers or garments; those reflect live wish-list data.
- **Calendar:** blank tall ivory tear-off paper, a dusty-clay header, two thin binder rings, small wooden pin, large unprinted writing area, and tiny layered paper edge. Live month/date/weekday/countdown are rendered by the app.

All furniture renders at one uniform scale. The shared desktop surface anchors the computer and lamp vignette; the cabinet surface anchors the book body and small lamp. The book ribbon can hang below its contact point. Native image dimensions and contact metadata are declared in `index.html`.

Run `node tests/room-art.cjs` to check image proportions, surface contact, desk continuity, and scene actions across twelve time/theme/content states.
