<script lang="ts">
  import type { FolderProposal, MoveProposal, RuleProposal, TemplateProposal, RuleConsolidationProposal } from '../../lib/services/openai';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));

  interface Props {
    type: 'folders' | 'moves' | 'rules' | 'templates' | 'consolidateRules';
    folderProposals?: FolderProposal[];
    moveProposals?: MoveProposal[];
    ruleProposals?: RuleProposal[];
    templateProposals?: TemplateProposal[];
    ruleConsolidationProposals?: RuleConsolidationProposal[];
    acceptedSet: Set<number>;
    onacceptfolder?: (idx: number, proposal: FolderProposal) => void;
    onacceptmove?: (idx: number, proposal: MoveProposal) => void;
    onacceptrule?: (idx: number, proposal: RuleProposal) => void;
    oneditrule?: (proposal: RuleProposal) => void;
    onaccepttemplate?: (idx: number, proposal: TemplateProposal) => void;
    onacceptconsolidation?: (idx: number, proposal: RuleConsolidationProposal) => void;
    onacceptall?: () => void;
  }

  let { type, folderProposals, moveProposals, ruleProposals, templateProposals, ruleConsolidationProposals, acceptedSet, onacceptfolder, onacceptmove, onacceptrule, oneditrule, onaccepttemplate, onacceptconsolidation, onacceptall }: Props = $props();

  let items = $derived(
    type === 'folders' ? folderProposals || [] :
    type === 'moves' ? moveProposals || [] :
    type === 'templates' ? templateProposals || [] :
    type === 'consolidateRules' ? ruleConsolidationProposals || [] :
    ruleProposals || []
  );
  let allAccepted = $derived(items.every((_, i) => acceptedSet.has(i)));
</script>

{#if items.length > 0}
  <div class="proposals-block">
    <div class="proposals-header">
      <span class="proposals-title">
        {type === 'folders' ? T('proposal_folders_title') :
         type === 'moves' ? T('proposal_moves_title') :
         type === 'templates' ? T('proposal_templates_title') :
         type === 'consolidateRules' ? T('proposal_consolidate_rules_title') :
         T('proposal_rules_title')} ({items.length})
      </span>
      {#if !allAccepted && onacceptall}
        <Button size="xs" variant="ghost" onclick={onacceptall}>
          {type === 'folders' ? T('proposal_create_all') :
           type === 'moves' ? T('proposal_consolidate_all') :
           type === 'templates' ? T('proposal_template_create_all') :
           type === 'consolidateRules' ? T('proposal_consolidate_rules_all') :
           T('proposal_accept_all')}
        </Button>
      {/if}
    </div>

    {#if type === 'folders' && folderProposals}
      {#each folderProposals as fp, idx}
        <div class="proposal-item" class:accepted={acceptedSet.has(idx)}>
          <div class="proposal-info">
            <span class="proposal-icon">&#128193;</span>
            <div>
              <strong>{fp.name}</strong>
              <small>{T('proposal_in_path')} {fp.parentPath} — {fp.description}</small>
            </div>
          </div>
          {#if acceptedSet.has(idx)}
            <span class="accepted-badge">{T('proposal_badge_created')}</span>
          {:else if onacceptfolder}
            <Button size="sm" variant="primary" onclick={() => onacceptfolder(idx, fp)}>{T('proposal_create')}</Button>
          {/if}
        </div>
      {/each}
    {/if}

    {#if type === 'moves' && moveProposals}
      {#each moveProposals as mp, idx}
        <div class="proposal-item" class:accepted={acceptedSet.has(idx)}>
          <div class="proposal-info">
            <span class="proposal-icon">&#8618;</span>
            <div>
              <strong>{mp.sourceFolderPath} &rarr; {mp.destFolderPath}</strong>
              <small>{mp.description}{mp.deleteSource ? ` ${T('proposal_move_and_delete')}` : ''}</small>
            </div>
          </div>
          {#if acceptedSet.has(idx)}
            <span class="accepted-badge">{T('proposal_badge_consolidated')}</span>
          {:else if onacceptmove}
            <Button size="sm" variant="primary" onclick={() => onacceptmove(idx, mp)}>{T('proposal_consolidate')}</Button>
          {/if}
        </div>
      {/each}
    {/if}

    {#if type === 'rules' && ruleProposals}
      {#each ruleProposals as rp, idx}
        <div class="proposal-item" class:accepted={acceptedSet.has(idx)}>
          <div class="proposal-info">
            <span class="proposal-icon">&#9881;</span>
            <div>
              <strong>{rp.rule.name}</strong>
              <small>{rp.description}</small>
              <div class="rule-summary">
                {#each rp.rule.conditions as cond}
                  <span class="detail-chip">{cond.field} {cond.operator} "{cond.value || (cond.boolValue ? T('common_yes') : T('common_no'))}"</span>
                {/each}
                <span class="arrow-chip">&rarr;</span>
                {#each rp.rule.actions as act}
                  <span class="detail-chip action-chip">{act.type}{act.folderId ? ` ${act.folderId}` : ''}{act.tagKey ? ` ${act.tagKey}` : ''}</span>
                {/each}
              </div>
            </div>
          </div>
          {#if acceptedSet.has(idx)}
            <span class="accepted-badge">{T('proposal_badge_saved')}</span>
          {:else}
            <div class="proposal-actions">
              {#if onacceptrule}
                <Button size="sm" variant="primary" onclick={() => onacceptrule(idx, rp)}>{T('common_accept')}</Button>
              {/if}
              {#if oneditrule}
                <Button size="sm" onclick={() => oneditrule(rp)}>{T('common_edit')}</Button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    {#if type === 'templates' && templateProposals}
      {#each templateProposals as tp, idx}
        <div class="proposal-item" class:accepted={acceptedSet.has(idx)}>
          <div class="proposal-info">
            <span class="proposal-icon">&#9993;</span>
            <div>
              <strong>{tp.template.name}</strong>
              <small>{tp.description}</small>
              <div class="rule-summary">
                <span class="detail-chip">{tp.template.sendMode === 'draft' ? T('templates_draft') : tp.template.sendMode === 'sendNow' ? T('templates_send_now') : T('templates_send_later')}</span>
                <span class="detail-chip">{tp.template.replyType === 'replyToSender' ? T('templates_reply') : T('templates_reply_all')}</span>
                {#if tp.template.subject}
                  <span class="detail-chip action-chip">{tp.template.subject}</span>
                {/if}
              </div>
            </div>
          </div>
          {#if acceptedSet.has(idx)}
            <span class="accepted-badge">{T('proposal_badge_template_created')}</span>
          {:else if onaccepttemplate}
            <Button size="sm" variant="primary" onclick={() => onaccepttemplate(idx, tp)}>{T('proposal_create')}</Button>
          {/if}
        </div>
      {/each}
    {/if}

    {#if type === 'consolidateRules' && ruleConsolidationProposals}
      {#each ruleConsolidationProposals as rc, idx}
        <div class="proposal-item" class:accepted={acceptedSet.has(idx)}>
          <div class="proposal-info">
            <span class="proposal-icon">&#128256;</span>
            <div>
              <strong>{rc.sourceRuleNames.join(' + ')} &rarr; {rc.mergedRule.name}</strong>
              <small>{rc.description}</small>
              <div class="rule-summary">
                {#each rc.mergedRule.conditions as cond}
                  <span class="detail-chip">{cond.field} {cond.operator} "{cond.value || (cond.boolValue ? T('common_yes') : T('common_no'))}"</span>
                {/each}
                <span class="arrow-chip">&rarr;</span>
                {#each rc.mergedRule.actions as act}
                  <span class="detail-chip action-chip">{act.type}{act.folderId ? ` ${act.folderId}` : ''}{act.tagKey ? ` ${act.tagKey}` : ''}</span>
                {/each}
              </div>
            </div>
          </div>
          {#if acceptedSet.has(idx)}
            <span class="accepted-badge">{T('proposal_badge_rules_consolidated')}</span>
          {:else if onacceptconsolidation}
            <Button size="sm" variant="primary" onclick={() => onacceptconsolidation(idx, rc)}>{T('proposal_consolidate')}</Button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .proposals-block {
    margin-top: 10px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-primary, white);
  }
  .proposals-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary, #f9f9fb);
    border-bottom: 1px solid var(--border-color, #e0e0e6);
  }
  .proposals-title {
    font-size: 12px;
    font-weight: 600;
  }
  .proposal-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #e0e0e6);
    gap: 10px;
  }
  .proposal-item:last-child {
    border-bottom: none;
  }
  .proposal-item.accepted {
    opacity: 0.6;
    background: #f0f9f0;
  }
  .proposal-info {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
  }
  .proposal-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .proposal-info div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .proposal-info strong {
    font-size: 12px;
  }
  .proposal-info small {
    font-size: 11px;
    color: var(--text-secondary, #666);
    word-break: break-word;
  }
  .proposal-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .accepted-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 500;
    flex-shrink: 0;
  }
  .rule-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 3px;
    align-items: center;
    max-width: 100%;
  }
  .detail-chip {
    background: var(--bg-hover, #e0e0e6);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
  }
  .arrow-chip {
    font-size: 10px;
    color: var(--text-secondary, #666);
  }
  .action-chip {
    background: #e3f2fd !important;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .proposal-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .proposal-actions {
      align-self: flex-end;
    }
    .accepted-badge {
      align-self: flex-end;
    }
    .proposals-header {
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .detail-chip {
      font-size: 10px;
      padding: 2px 6px;
      word-break: break-word;
    }
  }

  @media (max-width: 400px) {
    .proposals-block {
      border-radius: 4px;
    }
    .proposal-item {
      padding: 10px 8px;
    }
    .proposal-info {
      width: 100%;
    }
    .proposal-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }

  @media (prefers-color-scheme: dark) {
    .proposal-item.accepted { background: #1b3320; }
    .accepted-badge { background: #1b4332; color: #95d5b2; }
    .action-chip { background: #1a3a5c !important; }
  }
</style>
