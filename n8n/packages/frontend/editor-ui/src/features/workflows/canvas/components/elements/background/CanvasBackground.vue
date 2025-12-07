<script setup lang="ts">
import { GRID_SIZE } from '@/app/utils/nodeViewUtils';
import CanvasBackgroundStripedPattern from './CanvasBackgroundStripedPattern.vue';
import { Background } from '@vue-flow/background';
import type { ViewportTransform } from '@vue-flow/core';

defineProps<{
	striped: boolean;
	viewport: ViewportTransform;
}>();
</script>
<template>
	<Background
		class="canvas-background"
		data-test-id="canvas-background"
		color="var(--canvas--color--background)"
		pattern-color="var(--canvas--dot--color)"
		:gap="GRID_SIZE"
	>
		<template v-if="striped" #pattern-container="patternProps">
			<CanvasBackgroundStripedPattern
				:id="patternProps.id"
				data-test-id="canvas-background-striped-pattern"
				:x="viewport.x"
				:y="viewport.y"
				:zoom="viewport.zoom"
			/>
		</template>
	</Background>
</template>

<style scoped lang="scss">
.canvas-background {
	background-color: var(--canvas--color--background);
}

.canvas-background :deep(circle),
.canvas-background :deep(path) {
	fill: var(--canvas--dot--color);
	stroke: var(--canvas--dot--color);
}
</style>
