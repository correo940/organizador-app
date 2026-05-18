import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import AudioComponent from './audio-component';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        audio: {
            setAudio: (options: { src: string }) => ReturnType;
        };
    }
}

export const AudioExtension = Node.create({
    name: 'audio',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'audio-component',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['audio-component', mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AudioComponent);
    },

    addCommands() {
        return {
            setAudio:
                (options) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: options,
                        });
                    },
        };
    },
});
