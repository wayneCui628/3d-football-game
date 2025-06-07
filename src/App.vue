<template>
  <div id="app">
    <StartScreen @gameStart="startGame" v-if="!gameStarted" />
    <MainGameScreen v-if="gameStarted" :game-started="gameStarted" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainGameScreen from "./views/MainGameScreen.vue";
import StartScreen from "./views/StartScreen.vue";

const gameStarted = ref(false);

const startGame = () => {
  gameStarted.value = true;
};
</script>

<style>
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
