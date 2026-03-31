<script>
  import "../app.css";
  import { dialogStore, handleDialogAction } from "$lib/dialogStore";
</script>

<div class="bg-background text-on-background min-h-screen">
  <main class="py-3 px-3 md:px-6 max-w-7xl mx-auto">
    <slot />
  </main>
</div>

<!-- Global Dialog -->
{#if $dialogStore.show}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-on-surface/60 backdrop-blur-[2px]"
      onclick={() => handleDialogAction(false)}
    ></div>
    
    <!-- Dialog Card -->
    <div class="relative w-full max-w-sm bg-surface-container-lowest rounded-[2rem] shadow-2xl p-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
      <p class="text-on-surface text-lg font-headline font-bold leading-relaxed mb-10 whitespace-pre-wrap">{$dialogStore.message}</p>
      
      <div class="flex gap-3 w-full">
        {#if $dialogStore.type === 'confirm'}
          <button 
            onclick={() => handleDialogAction(false)}
            class="flex-1 py-4 bg-surface-container-high text-on-surface-variant rounded-2xl font-headline font-bold transition-all active:scale-95"
          >
            취소
          </button>
        {/if}
        <button 
          onclick={() => handleDialogAction(true)}
          class="flex-1 py-4 btn-primary-gradient text-on-primary rounded-2xl font-headline font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          확인
        </button>
      </div>
    </div>
  </div>
{/if}
