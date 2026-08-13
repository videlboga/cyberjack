import { describe, expect, it } from 'vitest';
import { applySubjectiveTagIntervention, hasAssociationLink, hasCompleteAssociationCoverage, SubjectiveEpisode } from './subjectiveMemoryEpisodes';
import { MemoryEpisode } from './memoryEpisodes';
import { db } from '../infrastructure/db';

const episode: MemoryEpisode = {
    id: 1, title: 'Эпизод', text: 'Текст', tags: ['oral', 'continuous', 'intense'],
    relatedSubjectIds: [], worldMinute: 1, atomCount: 1, moments: [],
};

const summary = (tagLinks: string[][]): SubjectiveEpisode => ({
    title: 'Личная память', summary: 'Текст', appraisal: '', agency: 'mixed', emotionalArc: [], openLoops: [],
    associations: tagLinks.map((links, index) => ({
        target: `Связь ${index}`, tagLinks: links, evidence: [], valence: 0, strength: .5, expectation: 'anticipate',
    })),
});

describe('subjective episode association coverage', () => {
    it('requires every episode tag to be represented by a concrete association', () => {
        expect(hasCompleteAssociationCoverage(summary([['oral', 'continuous']]), episode)).toBe(false);
        expect(hasCompleteAssociationCoverage({ ...summary([['oral'], ['continuous', 'intense']]), associations: summary([['oral'], ['continuous', 'intense']]).associations.map(item => ({ ...item, evidence: ['Текст'] })) }, episode)).toBe(true);
    });

    it('recognizes only an association that joins all manually selected tags', () => {
        const linked = { ...summary([['oral', 'continuous'], ['intense']]), associations: summary([['oral', 'continuous'], ['intense']]).associations.map(item => ({ ...item, evidence: ['Текст'] })) };
        expect(hasAssociationLink(linked, ['oral'])).toBe(true);
        expect(hasAssociationLink(linked, ['oral', 'continuous'])).toBe(true);
        expect(hasAssociationLink(linked, ['oral', 'intense'])).toBe(false);
    });
});

describe('tag-level intervention', () => {
    const subjectId = '__test_tag_anchor__';
    const tagEpisode = { ...episode, id: 998001, tags: ['oral'] };
    const sourceKey = '998001::tag:oral';

    it('creates an independent tag anchor without regenerating an episode', () => {
        db.prepare('DELETE FROM subjective_associations WHERE subject_id = ?').run(subjectId);
        db.prepare('DELETE FROM memory_association_effects WHERE subject_id = ?').run(subjectId);
        const result = applySubjectiveTagIntervention(subjectId, tagEpisode, 'oral', 'оральное', 'anxiety', .5);
        expect(result.affected).toBe(1);
        expect(result.changes[0].after.expectation).toBe('avoid');
        const anchor = db.prepare(`SELECT tag_links, valence FROM subjective_associations WHERE subject_id = ? AND source_key = ?`).get(subjectId, sourceKey) as any;
        expect(JSON.parse(anchor.tag_links)).toEqual(['oral']);
        expect(anchor.valence).toBeLessThan(0);
        const effect = db.prepare('SELECT weight FROM memory_association_effects WHERE subject_id = ? AND source_key = ? AND tag = ?').get(subjectId, sourceKey, 'oral') as any;
        expect(effect.weight).toBeLessThan(0);
        db.prepare('DELETE FROM subjective_associations WHERE subject_id = ?').run(subjectId);
        db.prepare('DELETE FROM memory_association_effects WHERE subject_id = ?').run(subjectId);
    });
});
