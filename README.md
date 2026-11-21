# Trace Anything

Trace Anything reverse engineers any image into real HTML, CSS and TS components.

## How it works

You give it a picture of a UI section. The tool extracts a visual spec, generates the component, renders it, scores the result against the original image, and sends the mismatches back for another pass. That build, render, score, and fix loop repeats until the match clears a set threshold or it hits a round limit.

Work happens one section at a time, not as a whole page in one shot. Full pages come later by stitching scored sections together.

## Goal

Beat screenshot-to-code and v0 on the public Design2Code benchmark, using Design2Code's official metrics, and publish the comparison.

## Status

Spec stage. Nothing is implemented yet. The first work is a baseline run of screenshot-to-code on a fixed Design2Code slice, then a v0.1 loop that turns a single section image into a component.
