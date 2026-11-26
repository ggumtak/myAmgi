import * as $protobuf from "protobufjs";
import type Long from "long";

/** Namespace anki. */
export namespace anki {

    /** Namespace card_rendering. */
    namespace card_rendering {

        /**
         * Properties of an ExtractAvTagsRequest.
         * @deprecated Use anki.card_rendering.ExtractAvTagsRequest.$Properties instead.
         */
        interface IExtractAvTagsRequest extends anki.card_rendering.ExtractAvTagsRequest.$Properties {
        }

        /** Represents an ExtractAvTagsRequest. */
        class ExtractAvTagsRequest {

            /**
             * Constructs a new ExtractAvTagsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.ExtractAvTagsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ExtractAvTagsRequest text. */
            text: string;

            /** ExtractAvTagsRequest questionSide. */
            questionSide: boolean;

            /**
             * Creates a new ExtractAvTagsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ExtractAvTagsRequest instance
             */
            static create(properties: anki.card_rendering.ExtractAvTagsRequest.$Shape): anki.card_rendering.ExtractAvTagsRequest & anki.card_rendering.ExtractAvTagsRequest.$Shape;
            static create(properties?: anki.card_rendering.ExtractAvTagsRequest.$Properties): anki.card_rendering.ExtractAvTagsRequest;

            /**
             * Encodes the specified ExtractAvTagsRequest message. Does not implicitly {@link anki.card_rendering.ExtractAvTagsRequest.verify|verify} messages.
             * @param message ExtractAvTagsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.ExtractAvTagsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an ExtractAvTagsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.ExtractAvTagsRequest & anki.card_rendering.ExtractAvTagsRequest.$Shape} ExtractAvTagsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.ExtractAvTagsRequest & anki.card_rendering.ExtractAvTagsRequest.$Shape;
        }

        namespace ExtractAvTagsRequest {

            /** Properties of an ExtractAvTagsRequest. */
            interface $Properties {

                /** ExtractAvTagsRequest text */
                text?: (string|null);

                /** ExtractAvTagsRequest questionSide */
                questionSide?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an ExtractAvTagsRequest. */
            type $Shape = anki.card_rendering.ExtractAvTagsRequest.$Properties;
        }

        /**
         * Properties of an ExtractAvTagsResponse.
         * @deprecated Use anki.card_rendering.ExtractAvTagsResponse.$Properties instead.
         */
        interface IExtractAvTagsResponse extends anki.card_rendering.ExtractAvTagsResponse.$Properties {
        }

        /** Represents an ExtractAvTagsResponse. */
        class ExtractAvTagsResponse {

            /**
             * Constructs a new ExtractAvTagsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.ExtractAvTagsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ExtractAvTagsResponse text. */
            text: string;

            /** ExtractAvTagsResponse avTags. */
            avTags: anki.card_rendering.AVTag.$Properties[];

            /**
             * Creates a new ExtractAvTagsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ExtractAvTagsResponse instance
             */
            static create(properties: anki.card_rendering.ExtractAvTagsResponse.$Shape): anki.card_rendering.ExtractAvTagsResponse & anki.card_rendering.ExtractAvTagsResponse.$Shape;
            static create(properties?: anki.card_rendering.ExtractAvTagsResponse.$Properties): anki.card_rendering.ExtractAvTagsResponse;

            /**
             * Encodes the specified ExtractAvTagsResponse message. Does not implicitly {@link anki.card_rendering.ExtractAvTagsResponse.verify|verify} messages.
             * @param message ExtractAvTagsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.ExtractAvTagsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an ExtractAvTagsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.ExtractAvTagsResponse & anki.card_rendering.ExtractAvTagsResponse.$Shape} ExtractAvTagsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.ExtractAvTagsResponse & anki.card_rendering.ExtractAvTagsResponse.$Shape;
        }

        namespace ExtractAvTagsResponse {

            /** Properties of an ExtractAvTagsResponse. */
            interface $Properties {

                /** ExtractAvTagsResponse text */
                text?: (string|null);

                /** ExtractAvTagsResponse avTags */
                avTags?: (anki.card_rendering.AVTag.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an ExtractAvTagsResponse. */
            type $Shape = {
              text?: string|null;
              avTags?: anki.card_rendering.AVTag.$Shape[]|null;
              $unknowns?: Uint8Array[];
            };
        }

        /**
         * Properties of a AVTag.
         * @deprecated Use anki.card_rendering.AVTag.$Properties instead.
         */
        interface IAVTag extends anki.card_rendering.AVTag.$Properties {
        }

        /** Represents a AVTag. */
        class AVTag {

            /**
             * Constructs a new AVTag.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.AVTag.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** AVTag soundOrVideo. */
            soundOrVideo?: (string|null);

            /** AVTag tts. */
            tts?: (anki.card_rendering.TTSTag.$Properties|null);

            /** AVTag value. */
            value?: ("soundOrVideo"|"tts");

            /**
             * Creates a new AVTag instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AVTag instance
             */
            static create(properties: anki.card_rendering.AVTag.$Shape): anki.card_rendering.AVTag & anki.card_rendering.AVTag.$Shape;
            static create(properties?: anki.card_rendering.AVTag.$Properties): anki.card_rendering.AVTag;

            /**
             * Encodes the specified AVTag message. Does not implicitly {@link anki.card_rendering.AVTag.verify|verify} messages.
             * @param message AVTag message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.AVTag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a AVTag message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.AVTag & anki.card_rendering.AVTag.$Shape} AVTag
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.AVTag & anki.card_rendering.AVTag.$Shape;
        }

        namespace AVTag {

            /** Properties of a AVTag. */
            interface $Properties {

                /** AVTag soundOrVideo */
                soundOrVideo?: (string|null);

                /** AVTag tts */
                tts?: (anki.card_rendering.TTSTag.$Properties|null);

                /** AVTag value */
                value?: ("soundOrVideo"|"tts");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a AVTag. */
            type $Shape = {
              soundOrVideo?: string|null;
              tts?: anki.card_rendering.TTSTag.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ value?: undefined; soundOrVideo?: null; tts?: null }|{ value?: "soundOrVideo"; soundOrVideo: string; tts?: null }|{ value?: "tts"; soundOrVideo?: null; tts: anki.card_rendering.TTSTag.$Shape })
            );
        }

        /**
         * Properties of a TTSTag.
         * @deprecated Use anki.card_rendering.TTSTag.$Properties instead.
         */
        interface ITTSTag extends anki.card_rendering.TTSTag.$Properties {
        }

        /** Represents a TTSTag. */
        class TTSTag {

            /**
             * Constructs a new TTSTag.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.TTSTag.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** TTSTag fieldText. */
            fieldText: string;

            /** TTSTag lang. */
            lang: string;

            /** TTSTag voices. */
            voices: string[];

            /** TTSTag speed. */
            speed: number;

            /** TTSTag otherArgs. */
            otherArgs: string[];

            /**
             * Creates a new TTSTag instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TTSTag instance
             */
            static create(properties: anki.card_rendering.TTSTag.$Shape): anki.card_rendering.TTSTag & anki.card_rendering.TTSTag.$Shape;
            static create(properties?: anki.card_rendering.TTSTag.$Properties): anki.card_rendering.TTSTag;

            /**
             * Encodes the specified TTSTag message. Does not implicitly {@link anki.card_rendering.TTSTag.verify|verify} messages.
             * @param message TTSTag message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.TTSTag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TTSTag message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.TTSTag & anki.card_rendering.TTSTag.$Shape} TTSTag
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.TTSTag & anki.card_rendering.TTSTag.$Shape;
        }

        namespace TTSTag {

            /** Properties of a TTSTag. */
            interface $Properties {

                /** TTSTag fieldText */
                fieldText?: (string|null);

                /** TTSTag lang */
                lang?: (string|null);

                /** TTSTag voices */
                voices?: (string[]|null);

                /** TTSTag speed */
                speed?: (number|null);

                /** TTSTag otherArgs */
                otherArgs?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a TTSTag. */
            type $Shape = anki.card_rendering.TTSTag.$Properties;
        }

        /**
         * Properties of an EmptyCardsReport.
         * @deprecated Use anki.card_rendering.EmptyCardsReport.$Properties instead.
         */
        interface IEmptyCardsReport extends anki.card_rendering.EmptyCardsReport.$Properties {
        }

        /** Represents an EmptyCardsReport. */
        class EmptyCardsReport {

            /**
             * Constructs a new EmptyCardsReport.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.EmptyCardsReport.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** EmptyCardsReport report. */
            report: string;

            /** EmptyCardsReport notes. */
            notes: anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties[];

            /**
             * Creates a new EmptyCardsReport instance using the specified properties.
             * @param [properties] Properties to set
             * @returns EmptyCardsReport instance
             */
            static create(properties: anki.card_rendering.EmptyCardsReport.$Shape): anki.card_rendering.EmptyCardsReport & anki.card_rendering.EmptyCardsReport.$Shape;
            static create(properties?: anki.card_rendering.EmptyCardsReport.$Properties): anki.card_rendering.EmptyCardsReport;

            /**
             * Encodes the specified EmptyCardsReport message. Does not implicitly {@link anki.card_rendering.EmptyCardsReport.verify|verify} messages.
             * @param message EmptyCardsReport message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.EmptyCardsReport.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an EmptyCardsReport message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.EmptyCardsReport & anki.card_rendering.EmptyCardsReport.$Shape} EmptyCardsReport
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.EmptyCardsReport & anki.card_rendering.EmptyCardsReport.$Shape;
        }

        namespace EmptyCardsReport {

            /** Properties of an EmptyCardsReport. */
            interface $Properties {

                /** EmptyCardsReport report */
                report?: (string|null);

                /** EmptyCardsReport notes */
                notes?: (anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an EmptyCardsReport. */
            type $Shape = anki.card_rendering.EmptyCardsReport.$Properties;

            /**
             * Properties of a NoteWithEmptyCards.
             * @deprecated Use anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties instead.
             */
            interface INoteWithEmptyCards extends anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties {
            }

            /** Represents a NoteWithEmptyCards. */
            class NoteWithEmptyCards {

                /**
                 * Constructs a new NoteWithEmptyCards.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** NoteWithEmptyCards noteId. */
                noteId: (number|Long);

                /** NoteWithEmptyCards cardIds. */
                cardIds: (number|Long)[];

                /** NoteWithEmptyCards willDeleteNote. */
                willDeleteNote: boolean;

                /**
                 * Creates a new NoteWithEmptyCards instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns NoteWithEmptyCards instance
                 */
                static create(properties: anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Shape): anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards & anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Shape;
                static create(properties?: anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties): anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards;

                /**
                 * Encodes the specified NoteWithEmptyCards message. Does not implicitly {@link anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.verify|verify} messages.
                 * @param message NoteWithEmptyCards message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a NoteWithEmptyCards message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards & anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Shape} NoteWithEmptyCards
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards & anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Shape;
            }

            namespace NoteWithEmptyCards {

                /** Properties of a NoteWithEmptyCards. */
                interface $Properties {

                    /** NoteWithEmptyCards noteId */
                    noteId?: (number|Long|null);

                    /** NoteWithEmptyCards cardIds */
                    cardIds?: ((number|Long)[]|null);

                    /** NoteWithEmptyCards willDeleteNote */
                    willDeleteNote?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a NoteWithEmptyCards. */
                type $Shape = anki.card_rendering.EmptyCardsReport.NoteWithEmptyCards.$Properties;
            }
        }

        /**
         * Properties of a RenderExistingCardRequest.
         * @deprecated Use anki.card_rendering.RenderExistingCardRequest.$Properties instead.
         */
        interface IRenderExistingCardRequest extends anki.card_rendering.RenderExistingCardRequest.$Properties {
        }

        /** Represents a RenderExistingCardRequest. */
        class RenderExistingCardRequest {

            /**
             * Constructs a new RenderExistingCardRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.RenderExistingCardRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenderExistingCardRequest cardId. */
            cardId: (number|Long);

            /** RenderExistingCardRequest browser. */
            browser: boolean;

            /** RenderExistingCardRequest partialRender. */
            partialRender: boolean;

            /**
             * Creates a new RenderExistingCardRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenderExistingCardRequest instance
             */
            static create(properties: anki.card_rendering.RenderExistingCardRequest.$Shape): anki.card_rendering.RenderExistingCardRequest & anki.card_rendering.RenderExistingCardRequest.$Shape;
            static create(properties?: anki.card_rendering.RenderExistingCardRequest.$Properties): anki.card_rendering.RenderExistingCardRequest;

            /**
             * Encodes the specified RenderExistingCardRequest message. Does not implicitly {@link anki.card_rendering.RenderExistingCardRequest.verify|verify} messages.
             * @param message RenderExistingCardRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.RenderExistingCardRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenderExistingCardRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.RenderExistingCardRequest & anki.card_rendering.RenderExistingCardRequest.$Shape} RenderExistingCardRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.RenderExistingCardRequest & anki.card_rendering.RenderExistingCardRequest.$Shape;
        }

        namespace RenderExistingCardRequest {

            /** Properties of a RenderExistingCardRequest. */
            interface $Properties {

                /** RenderExistingCardRequest cardId */
                cardId?: (number|Long|null);

                /** RenderExistingCardRequest browser */
                browser?: (boolean|null);

                /** RenderExistingCardRequest partialRender */
                partialRender?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenderExistingCardRequest. */
            type $Shape = anki.card_rendering.RenderExistingCardRequest.$Properties;
        }

        /**
         * Properties of a RenderUncommittedCardRequest.
         * @deprecated Use anki.card_rendering.RenderUncommittedCardRequest.$Properties instead.
         */
        interface IRenderUncommittedCardRequest extends anki.card_rendering.RenderUncommittedCardRequest.$Properties {
        }

        /** Represents a RenderUncommittedCardRequest. */
        class RenderUncommittedCardRequest {

            /**
             * Constructs a new RenderUncommittedCardRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.RenderUncommittedCardRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenderUncommittedCardRequest note. */
            note?: (anki.notes.Note.$Properties|null);

            /** RenderUncommittedCardRequest cardOrd. */
            cardOrd: number;

            /** RenderUncommittedCardRequest template. */
            template?: (anki.notetypes.Notetype.Template.$Properties|null);

            /** RenderUncommittedCardRequest fillEmpty. */
            fillEmpty: boolean;

            /** RenderUncommittedCardRequest partialRender. */
            partialRender: boolean;

            /**
             * Creates a new RenderUncommittedCardRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenderUncommittedCardRequest instance
             */
            static create(properties: anki.card_rendering.RenderUncommittedCardRequest.$Shape): anki.card_rendering.RenderUncommittedCardRequest & anki.card_rendering.RenderUncommittedCardRequest.$Shape;
            static create(properties?: anki.card_rendering.RenderUncommittedCardRequest.$Properties): anki.card_rendering.RenderUncommittedCardRequest;

            /**
             * Encodes the specified RenderUncommittedCardRequest message. Does not implicitly {@link anki.card_rendering.RenderUncommittedCardRequest.verify|verify} messages.
             * @param message RenderUncommittedCardRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.RenderUncommittedCardRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenderUncommittedCardRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.RenderUncommittedCardRequest & anki.card_rendering.RenderUncommittedCardRequest.$Shape} RenderUncommittedCardRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.RenderUncommittedCardRequest & anki.card_rendering.RenderUncommittedCardRequest.$Shape;
        }

        namespace RenderUncommittedCardRequest {

            /** Properties of a RenderUncommittedCardRequest. */
            interface $Properties {

                /** RenderUncommittedCardRequest note */
                note?: (anki.notes.Note.$Properties|null);

                /** RenderUncommittedCardRequest cardOrd */
                cardOrd?: (number|null);

                /** RenderUncommittedCardRequest template */
                template?: (anki.notetypes.Notetype.Template.$Properties|null);

                /** RenderUncommittedCardRequest fillEmpty */
                fillEmpty?: (boolean|null);

                /** RenderUncommittedCardRequest partialRender */
                partialRender?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenderUncommittedCardRequest. */
            type $Shape = anki.card_rendering.RenderUncommittedCardRequest.$Properties;
        }

        /**
         * Properties of a RenderCardResponse.
         * @deprecated Use anki.card_rendering.RenderCardResponse.$Properties instead.
         */
        interface IRenderCardResponse extends anki.card_rendering.RenderCardResponse.$Properties {
        }

        /** Represents a RenderCardResponse. */
        class RenderCardResponse {

            /**
             * Constructs a new RenderCardResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.RenderCardResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenderCardResponse questionNodes. */
            questionNodes: anki.card_rendering.RenderedTemplateNode.$Properties[];

            /** RenderCardResponse answerNodes. */
            answerNodes: anki.card_rendering.RenderedTemplateNode.$Properties[];

            /** RenderCardResponse css. */
            css: string;

            /** RenderCardResponse latexSvg. */
            latexSvg: boolean;

            /** RenderCardResponse isEmpty. */
            isEmpty: boolean;

            /**
             * Creates a new RenderCardResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenderCardResponse instance
             */
            static create(properties: anki.card_rendering.RenderCardResponse.$Shape): anki.card_rendering.RenderCardResponse & anki.card_rendering.RenderCardResponse.$Shape;
            static create(properties?: anki.card_rendering.RenderCardResponse.$Properties): anki.card_rendering.RenderCardResponse;

            /**
             * Encodes the specified RenderCardResponse message. Does not implicitly {@link anki.card_rendering.RenderCardResponse.verify|verify} messages.
             * @param message RenderCardResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.RenderCardResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenderCardResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.RenderCardResponse & anki.card_rendering.RenderCardResponse.$Shape} RenderCardResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.RenderCardResponse & anki.card_rendering.RenderCardResponse.$Shape;
        }

        namespace RenderCardResponse {

            /** Properties of a RenderCardResponse. */
            interface $Properties {

                /** RenderCardResponse questionNodes */
                questionNodes?: (anki.card_rendering.RenderedTemplateNode.$Properties[]|null);

                /** RenderCardResponse answerNodes */
                answerNodes?: (anki.card_rendering.RenderedTemplateNode.$Properties[]|null);

                /** RenderCardResponse css */
                css?: (string|null);

                /** RenderCardResponse latexSvg */
                latexSvg?: (boolean|null);

                /** RenderCardResponse isEmpty */
                isEmpty?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenderCardResponse. */
            type $Shape = {
              questionNodes?: anki.card_rendering.RenderedTemplateNode.$Shape[]|null;
              answerNodes?: anki.card_rendering.RenderedTemplateNode.$Shape[]|null;
              css?: string|null;
              latexSvg?: boolean|null;
              isEmpty?: boolean|null;
              $unknowns?: Uint8Array[];
            };
        }

        /**
         * Properties of a RenderedTemplateNode.
         * @deprecated Use anki.card_rendering.RenderedTemplateNode.$Properties instead.
         */
        interface IRenderedTemplateNode extends anki.card_rendering.RenderedTemplateNode.$Properties {
        }

        /** Represents a RenderedTemplateNode. */
        class RenderedTemplateNode {

            /**
             * Constructs a new RenderedTemplateNode.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.RenderedTemplateNode.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenderedTemplateNode text. */
            text?: (string|null);

            /** RenderedTemplateNode replacement. */
            replacement?: (anki.card_rendering.RenderedTemplateReplacement.$Properties|null);

            /** RenderedTemplateNode value. */
            value?: ("text"|"replacement");

            /**
             * Creates a new RenderedTemplateNode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenderedTemplateNode instance
             */
            static create(properties: anki.card_rendering.RenderedTemplateNode.$Shape): anki.card_rendering.RenderedTemplateNode & anki.card_rendering.RenderedTemplateNode.$Shape;
            static create(properties?: anki.card_rendering.RenderedTemplateNode.$Properties): anki.card_rendering.RenderedTemplateNode;

            /**
             * Encodes the specified RenderedTemplateNode message. Does not implicitly {@link anki.card_rendering.RenderedTemplateNode.verify|verify} messages.
             * @param message RenderedTemplateNode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.RenderedTemplateNode.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenderedTemplateNode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.RenderedTemplateNode & anki.card_rendering.RenderedTemplateNode.$Shape} RenderedTemplateNode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.RenderedTemplateNode & anki.card_rendering.RenderedTemplateNode.$Shape;
        }

        namespace RenderedTemplateNode {

            /** Properties of a RenderedTemplateNode. */
            interface $Properties {

                /** RenderedTemplateNode text */
                text?: (string|null);

                /** RenderedTemplateNode replacement */
                replacement?: (anki.card_rendering.RenderedTemplateReplacement.$Properties|null);

                /** RenderedTemplateNode value */
                value?: ("text"|"replacement");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a RenderedTemplateNode. */
            type $Shape = {
              text?: string|null;
              replacement?: anki.card_rendering.RenderedTemplateReplacement.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ value?: undefined; text?: null; replacement?: null }|{ value?: "text"; text: string; replacement?: null }|{ value?: "replacement"; text?: null; replacement: anki.card_rendering.RenderedTemplateReplacement.$Shape })
            );
        }

        /**
         * Properties of a RenderedTemplateReplacement.
         * @deprecated Use anki.card_rendering.RenderedTemplateReplacement.$Properties instead.
         */
        interface IRenderedTemplateReplacement extends anki.card_rendering.RenderedTemplateReplacement.$Properties {
        }

        /** Represents a RenderedTemplateReplacement. */
        class RenderedTemplateReplacement {

            /**
             * Constructs a new RenderedTemplateReplacement.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.RenderedTemplateReplacement.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenderedTemplateReplacement fieldName. */
            fieldName: string;

            /** RenderedTemplateReplacement currentText. */
            currentText: string;

            /** RenderedTemplateReplacement filters. */
            filters: string[];

            /**
             * Creates a new RenderedTemplateReplacement instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenderedTemplateReplacement instance
             */
            static create(properties: anki.card_rendering.RenderedTemplateReplacement.$Shape): anki.card_rendering.RenderedTemplateReplacement & anki.card_rendering.RenderedTemplateReplacement.$Shape;
            static create(properties?: anki.card_rendering.RenderedTemplateReplacement.$Properties): anki.card_rendering.RenderedTemplateReplacement;

            /**
             * Encodes the specified RenderedTemplateReplacement message. Does not implicitly {@link anki.card_rendering.RenderedTemplateReplacement.verify|verify} messages.
             * @param message RenderedTemplateReplacement message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.RenderedTemplateReplacement.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenderedTemplateReplacement message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.RenderedTemplateReplacement & anki.card_rendering.RenderedTemplateReplacement.$Shape} RenderedTemplateReplacement
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.RenderedTemplateReplacement & anki.card_rendering.RenderedTemplateReplacement.$Shape;
        }

        namespace RenderedTemplateReplacement {

            /** Properties of a RenderedTemplateReplacement. */
            interface $Properties {

                /** RenderedTemplateReplacement fieldName */
                fieldName?: (string|null);

                /** RenderedTemplateReplacement currentText */
                currentText?: (string|null);

                /** RenderedTemplateReplacement filters */
                filters?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenderedTemplateReplacement. */
            type $Shape = anki.card_rendering.RenderedTemplateReplacement.$Properties;
        }

        /**
         * Properties of a StripHtmlRequest.
         * @deprecated Use anki.card_rendering.StripHtmlRequest.$Properties instead.
         */
        interface IStripHtmlRequest extends anki.card_rendering.StripHtmlRequest.$Properties {
        }

        /** Represents a StripHtmlRequest. */
        class StripHtmlRequest {

            /**
             * Constructs a new StripHtmlRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.StripHtmlRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** StripHtmlRequest text. */
            text: string;

            /** StripHtmlRequest mode. */
            mode: anki.card_rendering.StripHtmlRequest.Mode;

            /**
             * Creates a new StripHtmlRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns StripHtmlRequest instance
             */
            static create(properties: anki.card_rendering.StripHtmlRequest.$Shape): anki.card_rendering.StripHtmlRequest & anki.card_rendering.StripHtmlRequest.$Shape;
            static create(properties?: anki.card_rendering.StripHtmlRequest.$Properties): anki.card_rendering.StripHtmlRequest;

            /**
             * Encodes the specified StripHtmlRequest message. Does not implicitly {@link anki.card_rendering.StripHtmlRequest.verify|verify} messages.
             * @param message StripHtmlRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.StripHtmlRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a StripHtmlRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.StripHtmlRequest & anki.card_rendering.StripHtmlRequest.$Shape} StripHtmlRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.StripHtmlRequest & anki.card_rendering.StripHtmlRequest.$Shape;
        }

        namespace StripHtmlRequest {

            /** Properties of a StripHtmlRequest. */
            interface $Properties {

                /** StripHtmlRequest text */
                text?: (string|null);

                /** StripHtmlRequest mode */
                mode?: (anki.card_rendering.StripHtmlRequest.Mode|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a StripHtmlRequest. */
            type $Shape = anki.card_rendering.StripHtmlRequest.$Properties;

            /** Mode enum. */
            enum Mode {

                /** NORMAL value */
                NORMAL = 0,

                /** PRESERVE_MEDIA_FILENAMES value */
                PRESERVE_MEDIA_FILENAMES = 1
            }
        }

        /**
         * Properties of a HtmlToTextLineRequest.
         * @deprecated Use anki.card_rendering.HtmlToTextLineRequest.$Properties instead.
         */
        interface IHtmlToTextLineRequest extends anki.card_rendering.HtmlToTextLineRequest.$Properties {
        }

        /** Represents a HtmlToTextLineRequest. */
        class HtmlToTextLineRequest {

            /**
             * Constructs a new HtmlToTextLineRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.HtmlToTextLineRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** HtmlToTextLineRequest text. */
            text: string;

            /** HtmlToTextLineRequest preserveMediaFilenames. */
            preserveMediaFilenames: boolean;

            /**
             * Creates a new HtmlToTextLineRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns HtmlToTextLineRequest instance
             */
            static create(properties: anki.card_rendering.HtmlToTextLineRequest.$Shape): anki.card_rendering.HtmlToTextLineRequest & anki.card_rendering.HtmlToTextLineRequest.$Shape;
            static create(properties?: anki.card_rendering.HtmlToTextLineRequest.$Properties): anki.card_rendering.HtmlToTextLineRequest;

            /**
             * Encodes the specified HtmlToTextLineRequest message. Does not implicitly {@link anki.card_rendering.HtmlToTextLineRequest.verify|verify} messages.
             * @param message HtmlToTextLineRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.HtmlToTextLineRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a HtmlToTextLineRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.HtmlToTextLineRequest & anki.card_rendering.HtmlToTextLineRequest.$Shape} HtmlToTextLineRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.HtmlToTextLineRequest & anki.card_rendering.HtmlToTextLineRequest.$Shape;
        }

        namespace HtmlToTextLineRequest {

            /** Properties of a HtmlToTextLineRequest. */
            interface $Properties {

                /** HtmlToTextLineRequest text */
                text?: (string|null);

                /** HtmlToTextLineRequest preserveMediaFilenames */
                preserveMediaFilenames?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a HtmlToTextLineRequest. */
            type $Shape = anki.card_rendering.HtmlToTextLineRequest.$Properties;
        }

        /**
         * Properties of a CompareAnswerRequest.
         * @deprecated Use anki.card_rendering.CompareAnswerRequest.$Properties instead.
         */
        interface ICompareAnswerRequest extends anki.card_rendering.CompareAnswerRequest.$Properties {
        }

        /** Represents a CompareAnswerRequest. */
        class CompareAnswerRequest {

            /**
             * Constructs a new CompareAnswerRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.CompareAnswerRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CompareAnswerRequest expected. */
            expected: string;

            /** CompareAnswerRequest provided. */
            provided: string;

            /** CompareAnswerRequest combining. */
            combining: boolean;

            /**
             * Creates a new CompareAnswerRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CompareAnswerRequest instance
             */
            static create(properties: anki.card_rendering.CompareAnswerRequest.$Shape): anki.card_rendering.CompareAnswerRequest & anki.card_rendering.CompareAnswerRequest.$Shape;
            static create(properties?: anki.card_rendering.CompareAnswerRequest.$Properties): anki.card_rendering.CompareAnswerRequest;

            /**
             * Encodes the specified CompareAnswerRequest message. Does not implicitly {@link anki.card_rendering.CompareAnswerRequest.verify|verify} messages.
             * @param message CompareAnswerRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.CompareAnswerRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CompareAnswerRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.CompareAnswerRequest & anki.card_rendering.CompareAnswerRequest.$Shape} CompareAnswerRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.CompareAnswerRequest & anki.card_rendering.CompareAnswerRequest.$Shape;
        }

        namespace CompareAnswerRequest {

            /** Properties of a CompareAnswerRequest. */
            interface $Properties {

                /** CompareAnswerRequest expected */
                expected?: (string|null);

                /** CompareAnswerRequest provided */
                provided?: (string|null);

                /** CompareAnswerRequest combining */
                combining?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CompareAnswerRequest. */
            type $Shape = anki.card_rendering.CompareAnswerRequest.$Properties;
        }

        /**
         * Properties of an ExtractClozeForTypingRequest.
         * @deprecated Use anki.card_rendering.ExtractClozeForTypingRequest.$Properties instead.
         */
        interface IExtractClozeForTypingRequest extends anki.card_rendering.ExtractClozeForTypingRequest.$Properties {
        }

        /** Represents an ExtractClozeForTypingRequest. */
        class ExtractClozeForTypingRequest {

            /**
             * Constructs a new ExtractClozeForTypingRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.card_rendering.ExtractClozeForTypingRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ExtractClozeForTypingRequest text. */
            text: string;

            /** ExtractClozeForTypingRequest ordinal. */
            ordinal: number;

            /**
             * Creates a new ExtractClozeForTypingRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ExtractClozeForTypingRequest instance
             */
            static create(properties: anki.card_rendering.ExtractClozeForTypingRequest.$Shape): anki.card_rendering.ExtractClozeForTypingRequest & anki.card_rendering.ExtractClozeForTypingRequest.$Shape;
            static create(properties?: anki.card_rendering.ExtractClozeForTypingRequest.$Properties): anki.card_rendering.ExtractClozeForTypingRequest;

            /**
             * Encodes the specified ExtractClozeForTypingRequest message. Does not implicitly {@link anki.card_rendering.ExtractClozeForTypingRequest.verify|verify} messages.
             * @param message ExtractClozeForTypingRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.card_rendering.ExtractClozeForTypingRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an ExtractClozeForTypingRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.card_rendering.ExtractClozeForTypingRequest & anki.card_rendering.ExtractClozeForTypingRequest.$Shape} ExtractClozeForTypingRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.card_rendering.ExtractClozeForTypingRequest & anki.card_rendering.ExtractClozeForTypingRequest.$Shape;
        }

        namespace ExtractClozeForTypingRequest {

            /** Properties of an ExtractClozeForTypingRequest. */
            interface $Properties {

                /** ExtractClozeForTypingRequest text */
                text?: (string|null);

                /** ExtractClozeForTypingRequest ordinal */
                ordinal?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an ExtractClozeForTypingRequest. */
            type $Shape = anki.card_rendering.ExtractClozeForTypingRequest.$Properties;
        }
    }

    /** Namespace notes. */
    namespace notes {

        /**
         * Properties of a NoteId.
         * @deprecated Use anki.notes.NoteId.$Properties instead.
         */
        interface INoteId extends anki.notes.NoteId.$Properties {
        }

        /** Represents a NoteId. */
        class NoteId {

            /**
             * Constructs a new NoteId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.NoteId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NoteId nid. */
            nid: (number|Long);

            /**
             * Creates a new NoteId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NoteId instance
             */
            static create(properties: anki.notes.NoteId.$Shape): anki.notes.NoteId & anki.notes.NoteId.$Shape;
            static create(properties?: anki.notes.NoteId.$Properties): anki.notes.NoteId;

            /**
             * Encodes the specified NoteId message. Does not implicitly {@link anki.notes.NoteId.verify|verify} messages.
             * @param message NoteId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.NoteId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NoteId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.NoteId & anki.notes.NoteId.$Shape} NoteId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.NoteId & anki.notes.NoteId.$Shape;
        }

        namespace NoteId {

            /** Properties of a NoteId. */
            interface $Properties {

                /** NoteId nid */
                nid?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NoteId. */
            type $Shape = anki.notes.NoteId.$Properties;
        }

        /**
         * Properties of a NoteIds.
         * @deprecated Use anki.notes.NoteIds.$Properties instead.
         */
        interface INoteIds extends anki.notes.NoteIds.$Properties {
        }

        /** Represents a NoteIds. */
        class NoteIds {

            /**
             * Constructs a new NoteIds.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.NoteIds.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NoteIds noteIds. */
            noteIds: (number|Long)[];

            /**
             * Creates a new NoteIds instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NoteIds instance
             */
            static create(properties: anki.notes.NoteIds.$Shape): anki.notes.NoteIds & anki.notes.NoteIds.$Shape;
            static create(properties?: anki.notes.NoteIds.$Properties): anki.notes.NoteIds;

            /**
             * Encodes the specified NoteIds message. Does not implicitly {@link anki.notes.NoteIds.verify|verify} messages.
             * @param message NoteIds message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.NoteIds.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NoteIds message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.NoteIds & anki.notes.NoteIds.$Shape} NoteIds
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.NoteIds & anki.notes.NoteIds.$Shape;
        }

        namespace NoteIds {

            /** Properties of a NoteIds. */
            interface $Properties {

                /** NoteIds noteIds */
                noteIds?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NoteIds. */
            type $Shape = anki.notes.NoteIds.$Properties;
        }

        /**
         * Properties of a Note.
         * @deprecated Use anki.notes.Note.$Properties instead.
         */
        interface INote extends anki.notes.Note.$Properties {
        }

        /** Represents a Note. */
        class Note {

            /**
             * Constructs a new Note.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.Note.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Note id. */
            id: (number|Long);

            /** Note guid. */
            guid: string;

            /** Note notetypeId. */
            notetypeId: (number|Long);

            /** Note mtimeSecs. */
            mtimeSecs: number;

            /** Note usn. */
            usn: number;

            /** Note tags. */
            tags: string[];

            /** Note fields. */
            fields: string[];

            /**
             * Creates a new Note instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Note instance
             */
            static create(properties: anki.notes.Note.$Shape): anki.notes.Note & anki.notes.Note.$Shape;
            static create(properties?: anki.notes.Note.$Properties): anki.notes.Note;

            /**
             * Encodes the specified Note message. Does not implicitly {@link anki.notes.Note.verify|verify} messages.
             * @param message Note message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.Note.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Note message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.Note & anki.notes.Note.$Shape} Note
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.Note & anki.notes.Note.$Shape;
        }

        namespace Note {

            /** Properties of a Note. */
            interface $Properties {

                /** Note id */
                id?: (number|Long|null);

                /** Note guid */
                guid?: (string|null);

                /** Note notetypeId */
                notetypeId?: (number|Long|null);

                /** Note mtimeSecs */
                mtimeSecs?: (number|null);

                /** Note usn */
                usn?: (number|null);

                /** Note tags */
                tags?: (string[]|null);

                /** Note fields */
                fields?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Note. */
            type $Shape = anki.notes.Note.$Properties;
        }

        /**
         * Properties of an AddNoteRequest.
         * @deprecated Use anki.notes.AddNoteRequest.$Properties instead.
         */
        interface IAddNoteRequest extends anki.notes.AddNoteRequest.$Properties {
        }

        /** Represents an AddNoteRequest. */
        class AddNoteRequest {

            /**
             * Constructs a new AddNoteRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.AddNoteRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** AddNoteRequest note. */
            note?: (anki.notes.Note.$Properties|null);

            /** AddNoteRequest deckId. */
            deckId: (number|Long);

            /**
             * Creates a new AddNoteRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AddNoteRequest instance
             */
            static create(properties: anki.notes.AddNoteRequest.$Shape): anki.notes.AddNoteRequest & anki.notes.AddNoteRequest.$Shape;
            static create(properties?: anki.notes.AddNoteRequest.$Properties): anki.notes.AddNoteRequest;

            /**
             * Encodes the specified AddNoteRequest message. Does not implicitly {@link anki.notes.AddNoteRequest.verify|verify} messages.
             * @param message AddNoteRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.AddNoteRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an AddNoteRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.AddNoteRequest & anki.notes.AddNoteRequest.$Shape} AddNoteRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.AddNoteRequest & anki.notes.AddNoteRequest.$Shape;
        }

        namespace AddNoteRequest {

            /** Properties of an AddNoteRequest. */
            interface $Properties {

                /** AddNoteRequest note */
                note?: (anki.notes.Note.$Properties|null);

                /** AddNoteRequest deckId */
                deckId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an AddNoteRequest. */
            type $Shape = anki.notes.AddNoteRequest.$Properties;
        }

        /**
         * Properties of an AddNoteResponse.
         * @deprecated Use anki.notes.AddNoteResponse.$Properties instead.
         */
        interface IAddNoteResponse extends anki.notes.AddNoteResponse.$Properties {
        }

        /** Represents an AddNoteResponse. */
        class AddNoteResponse {

            /**
             * Constructs a new AddNoteResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.AddNoteResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** AddNoteResponse changes. */
            changes?: (anki.collection.OpChangesWithCount.$Properties|null);

            /** AddNoteResponse noteId. */
            noteId: (number|Long);

            /**
             * Creates a new AddNoteResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AddNoteResponse instance
             */
            static create(properties: anki.notes.AddNoteResponse.$Shape): anki.notes.AddNoteResponse & anki.notes.AddNoteResponse.$Shape;
            static create(properties?: anki.notes.AddNoteResponse.$Properties): anki.notes.AddNoteResponse;

            /**
             * Encodes the specified AddNoteResponse message. Does not implicitly {@link anki.notes.AddNoteResponse.verify|verify} messages.
             * @param message AddNoteResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.AddNoteResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an AddNoteResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.AddNoteResponse & anki.notes.AddNoteResponse.$Shape} AddNoteResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.AddNoteResponse & anki.notes.AddNoteResponse.$Shape;
        }

        namespace AddNoteResponse {

            /** Properties of an AddNoteResponse. */
            interface $Properties {

                /** AddNoteResponse changes */
                changes?: (anki.collection.OpChangesWithCount.$Properties|null);

                /** AddNoteResponse noteId */
                noteId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an AddNoteResponse. */
            type $Shape = anki.notes.AddNoteResponse.$Properties;
        }

        /**
         * Properties of an UpdateNotesRequest.
         * @deprecated Use anki.notes.UpdateNotesRequest.$Properties instead.
         */
        interface IUpdateNotesRequest extends anki.notes.UpdateNotesRequest.$Properties {
        }

        /** Represents an UpdateNotesRequest. */
        class UpdateNotesRequest {

            /**
             * Constructs a new UpdateNotesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.UpdateNotesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UpdateNotesRequest notes. */
            notes: anki.notes.Note.$Properties[];

            /** UpdateNotesRequest skipUndoEntry. */
            skipUndoEntry: boolean;

            /**
             * Creates a new UpdateNotesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UpdateNotesRequest instance
             */
            static create(properties: anki.notes.UpdateNotesRequest.$Shape): anki.notes.UpdateNotesRequest & anki.notes.UpdateNotesRequest.$Shape;
            static create(properties?: anki.notes.UpdateNotesRequest.$Properties): anki.notes.UpdateNotesRequest;

            /**
             * Encodes the specified UpdateNotesRequest message. Does not implicitly {@link anki.notes.UpdateNotesRequest.verify|verify} messages.
             * @param message UpdateNotesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.UpdateNotesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UpdateNotesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.UpdateNotesRequest & anki.notes.UpdateNotesRequest.$Shape} UpdateNotesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.UpdateNotesRequest & anki.notes.UpdateNotesRequest.$Shape;
        }

        namespace UpdateNotesRequest {

            /** Properties of an UpdateNotesRequest. */
            interface $Properties {

                /** UpdateNotesRequest notes */
                notes?: (anki.notes.Note.$Properties[]|null);

                /** UpdateNotesRequest skipUndoEntry */
                skipUndoEntry?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an UpdateNotesRequest. */
            type $Shape = anki.notes.UpdateNotesRequest.$Properties;
        }

        /**
         * Properties of a DefaultsForAddingRequest.
         * @deprecated Use anki.notes.DefaultsForAddingRequest.$Properties instead.
         */
        interface IDefaultsForAddingRequest extends anki.notes.DefaultsForAddingRequest.$Properties {
        }

        /** Represents a DefaultsForAddingRequest. */
        class DefaultsForAddingRequest {

            /**
             * Constructs a new DefaultsForAddingRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.DefaultsForAddingRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DefaultsForAddingRequest homeDeckOfCurrentReviewCard. */
            homeDeckOfCurrentReviewCard: (number|Long);

            /**
             * Creates a new DefaultsForAddingRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DefaultsForAddingRequest instance
             */
            static create(properties: anki.notes.DefaultsForAddingRequest.$Shape): anki.notes.DefaultsForAddingRequest & anki.notes.DefaultsForAddingRequest.$Shape;
            static create(properties?: anki.notes.DefaultsForAddingRequest.$Properties): anki.notes.DefaultsForAddingRequest;

            /**
             * Encodes the specified DefaultsForAddingRequest message. Does not implicitly {@link anki.notes.DefaultsForAddingRequest.verify|verify} messages.
             * @param message DefaultsForAddingRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.DefaultsForAddingRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DefaultsForAddingRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.DefaultsForAddingRequest & anki.notes.DefaultsForAddingRequest.$Shape} DefaultsForAddingRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.DefaultsForAddingRequest & anki.notes.DefaultsForAddingRequest.$Shape;
        }

        namespace DefaultsForAddingRequest {

            /** Properties of a DefaultsForAddingRequest. */
            interface $Properties {

                /** DefaultsForAddingRequest homeDeckOfCurrentReviewCard */
                homeDeckOfCurrentReviewCard?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DefaultsForAddingRequest. */
            type $Shape = anki.notes.DefaultsForAddingRequest.$Properties;
        }

        /**
         * Properties of a DeckAndNotetype.
         * @deprecated Use anki.notes.DeckAndNotetype.$Properties instead.
         */
        interface IDeckAndNotetype extends anki.notes.DeckAndNotetype.$Properties {
        }

        /** Represents a DeckAndNotetype. */
        class DeckAndNotetype {

            /**
             * Constructs a new DeckAndNotetype.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.DeckAndNotetype.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckAndNotetype deckId. */
            deckId: (number|Long);

            /** DeckAndNotetype notetypeId. */
            notetypeId: (number|Long);

            /**
             * Creates a new DeckAndNotetype instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckAndNotetype instance
             */
            static create(properties: anki.notes.DeckAndNotetype.$Shape): anki.notes.DeckAndNotetype & anki.notes.DeckAndNotetype.$Shape;
            static create(properties?: anki.notes.DeckAndNotetype.$Properties): anki.notes.DeckAndNotetype;

            /**
             * Encodes the specified DeckAndNotetype message. Does not implicitly {@link anki.notes.DeckAndNotetype.verify|verify} messages.
             * @param message DeckAndNotetype message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.DeckAndNotetype.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckAndNotetype message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.DeckAndNotetype & anki.notes.DeckAndNotetype.$Shape} DeckAndNotetype
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.DeckAndNotetype & anki.notes.DeckAndNotetype.$Shape;
        }

        namespace DeckAndNotetype {

            /** Properties of a DeckAndNotetype. */
            interface $Properties {

                /** DeckAndNotetype deckId */
                deckId?: (number|Long|null);

                /** DeckAndNotetype notetypeId */
                notetypeId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckAndNotetype. */
            type $Shape = anki.notes.DeckAndNotetype.$Properties;
        }

        /**
         * Properties of a RemoveNotesRequest.
         * @deprecated Use anki.notes.RemoveNotesRequest.$Properties instead.
         */
        interface IRemoveNotesRequest extends anki.notes.RemoveNotesRequest.$Properties {
        }

        /** Represents a RemoveNotesRequest. */
        class RemoveNotesRequest {

            /**
             * Constructs a new RemoveNotesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.RemoveNotesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RemoveNotesRequest noteIds. */
            noteIds: (number|Long)[];

            /** RemoveNotesRequest cardIds. */
            cardIds: (number|Long)[];

            /**
             * Creates a new RemoveNotesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RemoveNotesRequest instance
             */
            static create(properties: anki.notes.RemoveNotesRequest.$Shape): anki.notes.RemoveNotesRequest & anki.notes.RemoveNotesRequest.$Shape;
            static create(properties?: anki.notes.RemoveNotesRequest.$Properties): anki.notes.RemoveNotesRequest;

            /**
             * Encodes the specified RemoveNotesRequest message. Does not implicitly {@link anki.notes.RemoveNotesRequest.verify|verify} messages.
             * @param message RemoveNotesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.RemoveNotesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RemoveNotesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.RemoveNotesRequest & anki.notes.RemoveNotesRequest.$Shape} RemoveNotesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.RemoveNotesRequest & anki.notes.RemoveNotesRequest.$Shape;
        }

        namespace RemoveNotesRequest {

            /** Properties of a RemoveNotesRequest. */
            interface $Properties {

                /** RemoveNotesRequest noteIds */
                noteIds?: ((number|Long)[]|null);

                /** RemoveNotesRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RemoveNotesRequest. */
            type $Shape = anki.notes.RemoveNotesRequest.$Properties;
        }

        /**
         * Properties of a ClozeNumbersInNoteResponse.
         * @deprecated Use anki.notes.ClozeNumbersInNoteResponse.$Properties instead.
         */
        interface IClozeNumbersInNoteResponse extends anki.notes.ClozeNumbersInNoteResponse.$Properties {
        }

        /** Represents a ClozeNumbersInNoteResponse. */
        class ClozeNumbersInNoteResponse {

            /**
             * Constructs a new ClozeNumbersInNoteResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.ClozeNumbersInNoteResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ClozeNumbersInNoteResponse numbers. */
            numbers: number[];

            /**
             * Creates a new ClozeNumbersInNoteResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ClozeNumbersInNoteResponse instance
             */
            static create(properties: anki.notes.ClozeNumbersInNoteResponse.$Shape): anki.notes.ClozeNumbersInNoteResponse & anki.notes.ClozeNumbersInNoteResponse.$Shape;
            static create(properties?: anki.notes.ClozeNumbersInNoteResponse.$Properties): anki.notes.ClozeNumbersInNoteResponse;

            /**
             * Encodes the specified ClozeNumbersInNoteResponse message. Does not implicitly {@link anki.notes.ClozeNumbersInNoteResponse.verify|verify} messages.
             * @param message ClozeNumbersInNoteResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.ClozeNumbersInNoteResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ClozeNumbersInNoteResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.ClozeNumbersInNoteResponse & anki.notes.ClozeNumbersInNoteResponse.$Shape} ClozeNumbersInNoteResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.ClozeNumbersInNoteResponse & anki.notes.ClozeNumbersInNoteResponse.$Shape;
        }

        namespace ClozeNumbersInNoteResponse {

            /** Properties of a ClozeNumbersInNoteResponse. */
            interface $Properties {

                /** ClozeNumbersInNoteResponse numbers */
                numbers?: (number[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ClozeNumbersInNoteResponse. */
            type $Shape = anki.notes.ClozeNumbersInNoteResponse.$Properties;
        }

        /**
         * Properties of a FieldNamesForNotesRequest.
         * @deprecated Use anki.notes.FieldNamesForNotesRequest.$Properties instead.
         */
        interface IFieldNamesForNotesRequest extends anki.notes.FieldNamesForNotesRequest.$Properties {
        }

        /** Represents a FieldNamesForNotesRequest. */
        class FieldNamesForNotesRequest {

            /**
             * Constructs a new FieldNamesForNotesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.FieldNamesForNotesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FieldNamesForNotesRequest nids. */
            nids: (number|Long)[];

            /**
             * Creates a new FieldNamesForNotesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FieldNamesForNotesRequest instance
             */
            static create(properties: anki.notes.FieldNamesForNotesRequest.$Shape): anki.notes.FieldNamesForNotesRequest & anki.notes.FieldNamesForNotesRequest.$Shape;
            static create(properties?: anki.notes.FieldNamesForNotesRequest.$Properties): anki.notes.FieldNamesForNotesRequest;

            /**
             * Encodes the specified FieldNamesForNotesRequest message. Does not implicitly {@link anki.notes.FieldNamesForNotesRequest.verify|verify} messages.
             * @param message FieldNamesForNotesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.FieldNamesForNotesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FieldNamesForNotesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.FieldNamesForNotesRequest & anki.notes.FieldNamesForNotesRequest.$Shape} FieldNamesForNotesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.FieldNamesForNotesRequest & anki.notes.FieldNamesForNotesRequest.$Shape;
        }

        namespace FieldNamesForNotesRequest {

            /** Properties of a FieldNamesForNotesRequest. */
            interface $Properties {

                /** FieldNamesForNotesRequest nids */
                nids?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FieldNamesForNotesRequest. */
            type $Shape = anki.notes.FieldNamesForNotesRequest.$Properties;
        }

        /**
         * Properties of a FieldNamesForNotesResponse.
         * @deprecated Use anki.notes.FieldNamesForNotesResponse.$Properties instead.
         */
        interface IFieldNamesForNotesResponse extends anki.notes.FieldNamesForNotesResponse.$Properties {
        }

        /** Represents a FieldNamesForNotesResponse. */
        class FieldNamesForNotesResponse {

            /**
             * Constructs a new FieldNamesForNotesResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.FieldNamesForNotesResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FieldNamesForNotesResponse fields. */
            fields: string[];

            /**
             * Creates a new FieldNamesForNotesResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FieldNamesForNotesResponse instance
             */
            static create(properties: anki.notes.FieldNamesForNotesResponse.$Shape): anki.notes.FieldNamesForNotesResponse & anki.notes.FieldNamesForNotesResponse.$Shape;
            static create(properties?: anki.notes.FieldNamesForNotesResponse.$Properties): anki.notes.FieldNamesForNotesResponse;

            /**
             * Encodes the specified FieldNamesForNotesResponse message. Does not implicitly {@link anki.notes.FieldNamesForNotesResponse.verify|verify} messages.
             * @param message FieldNamesForNotesResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.FieldNamesForNotesResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FieldNamesForNotesResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.FieldNamesForNotesResponse & anki.notes.FieldNamesForNotesResponse.$Shape} FieldNamesForNotesResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.FieldNamesForNotesResponse & anki.notes.FieldNamesForNotesResponse.$Shape;
        }

        namespace FieldNamesForNotesResponse {

            /** Properties of a FieldNamesForNotesResponse. */
            interface $Properties {

                /** FieldNamesForNotesResponse fields */
                fields?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FieldNamesForNotesResponse. */
            type $Shape = anki.notes.FieldNamesForNotesResponse.$Properties;
        }

        /**
         * Properties of a NoteFieldsCheckResponse.
         * @deprecated Use anki.notes.NoteFieldsCheckResponse.$Properties instead.
         */
        interface INoteFieldsCheckResponse extends anki.notes.NoteFieldsCheckResponse.$Properties {
        }

        /** Represents a NoteFieldsCheckResponse. */
        class NoteFieldsCheckResponse {

            /**
             * Constructs a new NoteFieldsCheckResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notes.NoteFieldsCheckResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NoteFieldsCheckResponse state. */
            state: anki.notes.NoteFieldsCheckResponse.State;

            /**
             * Creates a new NoteFieldsCheckResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NoteFieldsCheckResponse instance
             */
            static create(properties: anki.notes.NoteFieldsCheckResponse.$Shape): anki.notes.NoteFieldsCheckResponse & anki.notes.NoteFieldsCheckResponse.$Shape;
            static create(properties?: anki.notes.NoteFieldsCheckResponse.$Properties): anki.notes.NoteFieldsCheckResponse;

            /**
             * Encodes the specified NoteFieldsCheckResponse message. Does not implicitly {@link anki.notes.NoteFieldsCheckResponse.verify|verify} messages.
             * @param message NoteFieldsCheckResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notes.NoteFieldsCheckResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NoteFieldsCheckResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notes.NoteFieldsCheckResponse & anki.notes.NoteFieldsCheckResponse.$Shape} NoteFieldsCheckResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notes.NoteFieldsCheckResponse & anki.notes.NoteFieldsCheckResponse.$Shape;
        }

        namespace NoteFieldsCheckResponse {

            /** Properties of a NoteFieldsCheckResponse. */
            interface $Properties {

                /** NoteFieldsCheckResponse state */
                state?: (anki.notes.NoteFieldsCheckResponse.State|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NoteFieldsCheckResponse. */
            type $Shape = anki.notes.NoteFieldsCheckResponse.$Properties;

            /** State enum. */
            enum State {

                /** NORMAL value */
                NORMAL = 0,

                /** EMPTY value */
                EMPTY = 1,

                /** DUPLICATE value */
                DUPLICATE = 2,

                /** MISSING_CLOZE value */
                MISSING_CLOZE = 3,

                /** NOTETYPE_NOT_CLOZE value */
                NOTETYPE_NOT_CLOZE = 4,

                /** FIELD_NOT_CLOZE value */
                FIELD_NOT_CLOZE = 5
            }
        }
    }

    /** Namespace collection. */
    namespace collection {

        /**
         * Properties of a CheckDatabaseResponse.
         * @deprecated Use anki.collection.CheckDatabaseResponse.$Properties instead.
         */
        interface ICheckDatabaseResponse extends anki.collection.CheckDatabaseResponse.$Properties {
        }

        /** Represents a CheckDatabaseResponse. */
        class CheckDatabaseResponse {

            /**
             * Constructs a new CheckDatabaseResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.CheckDatabaseResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CheckDatabaseResponse problems. */
            problems: string[];

            /**
             * Creates a new CheckDatabaseResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CheckDatabaseResponse instance
             */
            static create(properties: anki.collection.CheckDatabaseResponse.$Shape): anki.collection.CheckDatabaseResponse & anki.collection.CheckDatabaseResponse.$Shape;
            static create(properties?: anki.collection.CheckDatabaseResponse.$Properties): anki.collection.CheckDatabaseResponse;

            /**
             * Encodes the specified CheckDatabaseResponse message. Does not implicitly {@link anki.collection.CheckDatabaseResponse.verify|verify} messages.
             * @param message CheckDatabaseResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.CheckDatabaseResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CheckDatabaseResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.CheckDatabaseResponse & anki.collection.CheckDatabaseResponse.$Shape} CheckDatabaseResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.CheckDatabaseResponse & anki.collection.CheckDatabaseResponse.$Shape;
        }

        namespace CheckDatabaseResponse {

            /** Properties of a CheckDatabaseResponse. */
            interface $Properties {

                /** CheckDatabaseResponse problems */
                problems?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CheckDatabaseResponse. */
            type $Shape = anki.collection.CheckDatabaseResponse.$Properties;
        }

        /**
         * Properties of an OpChanges.
         * @deprecated Use anki.collection.OpChanges.$Properties instead.
         */
        interface IOpChanges extends anki.collection.OpChanges.$Properties {
        }

        /** Represents an OpChanges. */
        class OpChanges {

            /**
             * Constructs a new OpChanges.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.OpChanges.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** OpChanges card. */
            card: boolean;

            /** OpChanges note. */
            note: boolean;

            /** OpChanges deck. */
            deck: boolean;

            /** OpChanges tag. */
            tag: boolean;

            /** OpChanges notetype. */
            notetype: boolean;

            /** OpChanges config. */
            config: boolean;

            /** OpChanges deckConfig. */
            deckConfig: boolean;

            /** OpChanges mtime. */
            mtime: boolean;

            /** OpChanges browserTable. */
            browserTable: boolean;

            /** OpChanges browserSidebar. */
            browserSidebar: boolean;

            /** OpChanges noteText. */
            noteText: boolean;

            /** OpChanges studyQueues. */
            studyQueues: boolean;

            /**
             * Creates a new OpChanges instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OpChanges instance
             */
            static create(properties: anki.collection.OpChanges.$Shape): anki.collection.OpChanges & anki.collection.OpChanges.$Shape;
            static create(properties?: anki.collection.OpChanges.$Properties): anki.collection.OpChanges;

            /**
             * Encodes the specified OpChanges message. Does not implicitly {@link anki.collection.OpChanges.verify|verify} messages.
             * @param message OpChanges message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.OpChanges.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OpChanges message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.OpChanges & anki.collection.OpChanges.$Shape} OpChanges
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.OpChanges & anki.collection.OpChanges.$Shape;
        }

        namespace OpChanges {

            /** Properties of an OpChanges. */
            interface $Properties {

                /** OpChanges card */
                card?: (boolean|null);

                /** OpChanges note */
                note?: (boolean|null);

                /** OpChanges deck */
                deck?: (boolean|null);

                /** OpChanges tag */
                tag?: (boolean|null);

                /** OpChanges notetype */
                notetype?: (boolean|null);

                /** OpChanges config */
                config?: (boolean|null);

                /** OpChanges deckConfig */
                deckConfig?: (boolean|null);

                /** OpChanges mtime */
                mtime?: (boolean|null);

                /** OpChanges browserTable */
                browserTable?: (boolean|null);

                /** OpChanges browserSidebar */
                browserSidebar?: (boolean|null);

                /** OpChanges noteText */
                noteText?: (boolean|null);

                /** OpChanges studyQueues */
                studyQueues?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an OpChanges. */
            type $Shape = anki.collection.OpChanges.$Properties;
        }

        /**
         * Properties of an OpChangesWithCount.
         * @deprecated Use anki.collection.OpChangesWithCount.$Properties instead.
         */
        interface IOpChangesWithCount extends anki.collection.OpChangesWithCount.$Properties {
        }

        /** Represents an OpChangesWithCount. */
        class OpChangesWithCount {

            /**
             * Constructs a new OpChangesWithCount.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.OpChangesWithCount.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** OpChangesWithCount changes. */
            changes?: (anki.collection.OpChanges.$Properties|null);

            /** OpChangesWithCount count. */
            count: number;

            /**
             * Creates a new OpChangesWithCount instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OpChangesWithCount instance
             */
            static create(properties: anki.collection.OpChangesWithCount.$Shape): anki.collection.OpChangesWithCount & anki.collection.OpChangesWithCount.$Shape;
            static create(properties?: anki.collection.OpChangesWithCount.$Properties): anki.collection.OpChangesWithCount;

            /**
             * Encodes the specified OpChangesWithCount message. Does not implicitly {@link anki.collection.OpChangesWithCount.verify|verify} messages.
             * @param message OpChangesWithCount message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.OpChangesWithCount.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OpChangesWithCount message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.OpChangesWithCount & anki.collection.OpChangesWithCount.$Shape} OpChangesWithCount
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.OpChangesWithCount & anki.collection.OpChangesWithCount.$Shape;
        }

        namespace OpChangesWithCount {

            /** Properties of an OpChangesWithCount. */
            interface $Properties {

                /** OpChangesWithCount changes */
                changes?: (anki.collection.OpChanges.$Properties|null);

                /** OpChangesWithCount count */
                count?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an OpChangesWithCount. */
            type $Shape = anki.collection.OpChangesWithCount.$Properties;
        }

        /**
         * Properties of an OpChangesWithId.
         * @deprecated Use anki.collection.OpChangesWithId.$Properties instead.
         */
        interface IOpChangesWithId extends anki.collection.OpChangesWithId.$Properties {
        }

        /** Represents an OpChangesWithId. */
        class OpChangesWithId {

            /**
             * Constructs a new OpChangesWithId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.OpChangesWithId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** OpChangesWithId changes. */
            changes?: (anki.collection.OpChanges.$Properties|null);

            /** OpChangesWithId id. */
            id: (number|Long);

            /**
             * Creates a new OpChangesWithId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OpChangesWithId instance
             */
            static create(properties: anki.collection.OpChangesWithId.$Shape): anki.collection.OpChangesWithId & anki.collection.OpChangesWithId.$Shape;
            static create(properties?: anki.collection.OpChangesWithId.$Properties): anki.collection.OpChangesWithId;

            /**
             * Encodes the specified OpChangesWithId message. Does not implicitly {@link anki.collection.OpChangesWithId.verify|verify} messages.
             * @param message OpChangesWithId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.OpChangesWithId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OpChangesWithId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.OpChangesWithId & anki.collection.OpChangesWithId.$Shape} OpChangesWithId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.OpChangesWithId & anki.collection.OpChangesWithId.$Shape;
        }

        namespace OpChangesWithId {

            /** Properties of an OpChangesWithId. */
            interface $Properties {

                /** OpChangesWithId changes */
                changes?: (anki.collection.OpChanges.$Properties|null);

                /** OpChangesWithId id */
                id?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an OpChangesWithId. */
            type $Shape = anki.collection.OpChangesWithId.$Properties;
        }

        /**
         * Properties of an UndoStatus.
         * @deprecated Use anki.collection.UndoStatus.$Properties instead.
         */
        interface IUndoStatus extends anki.collection.UndoStatus.$Properties {
        }

        /** Represents an UndoStatus. */
        class UndoStatus {

            /**
             * Constructs a new UndoStatus.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.UndoStatus.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UndoStatus undo. */
            undo: string;

            /** UndoStatus redo. */
            redo: string;

            /** UndoStatus lastStep. */
            lastStep: number;

            /**
             * Creates a new UndoStatus instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UndoStatus instance
             */
            static create(properties: anki.collection.UndoStatus.$Shape): anki.collection.UndoStatus & anki.collection.UndoStatus.$Shape;
            static create(properties?: anki.collection.UndoStatus.$Properties): anki.collection.UndoStatus;

            /**
             * Encodes the specified UndoStatus message. Does not implicitly {@link anki.collection.UndoStatus.verify|verify} messages.
             * @param message UndoStatus message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.UndoStatus.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UndoStatus message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.UndoStatus & anki.collection.UndoStatus.$Shape} UndoStatus
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.UndoStatus & anki.collection.UndoStatus.$Shape;
        }

        namespace UndoStatus {

            /** Properties of an UndoStatus. */
            interface $Properties {

                /** UndoStatus undo */
                undo?: (string|null);

                /** UndoStatus redo */
                redo?: (string|null);

                /** UndoStatus lastStep */
                lastStep?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an UndoStatus. */
            type $Shape = anki.collection.UndoStatus.$Properties;
        }

        /**
         * Properties of an OpChangesAfterUndo.
         * @deprecated Use anki.collection.OpChangesAfterUndo.$Properties instead.
         */
        interface IOpChangesAfterUndo extends anki.collection.OpChangesAfterUndo.$Properties {
        }

        /** Represents an OpChangesAfterUndo. */
        class OpChangesAfterUndo {

            /**
             * Constructs a new OpChangesAfterUndo.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.collection.OpChangesAfterUndo.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** OpChangesAfterUndo changes. */
            changes?: (anki.collection.OpChanges.$Properties|null);

            /** OpChangesAfterUndo operation. */
            operation: string;

            /** OpChangesAfterUndo revertedToTimestamp. */
            revertedToTimestamp: (number|Long);

            /** OpChangesAfterUndo newStatus. */
            newStatus?: (anki.collection.UndoStatus.$Properties|null);

            /** OpChangesAfterUndo counter. */
            counter: number;

            /**
             * Creates a new OpChangesAfterUndo instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OpChangesAfterUndo instance
             */
            static create(properties: anki.collection.OpChangesAfterUndo.$Shape): anki.collection.OpChangesAfterUndo & anki.collection.OpChangesAfterUndo.$Shape;
            static create(properties?: anki.collection.OpChangesAfterUndo.$Properties): anki.collection.OpChangesAfterUndo;

            /**
             * Encodes the specified OpChangesAfterUndo message. Does not implicitly {@link anki.collection.OpChangesAfterUndo.verify|verify} messages.
             * @param message OpChangesAfterUndo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.collection.OpChangesAfterUndo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OpChangesAfterUndo message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.collection.OpChangesAfterUndo & anki.collection.OpChangesAfterUndo.$Shape} OpChangesAfterUndo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.collection.OpChangesAfterUndo & anki.collection.OpChangesAfterUndo.$Shape;
        }

        namespace OpChangesAfterUndo {

            /** Properties of an OpChangesAfterUndo. */
            interface $Properties {

                /** OpChangesAfterUndo changes */
                changes?: (anki.collection.OpChanges.$Properties|null);

                /** OpChangesAfterUndo operation */
                operation?: (string|null);

                /** OpChangesAfterUndo revertedToTimestamp */
                revertedToTimestamp?: (number|Long|null);

                /** OpChangesAfterUndo newStatus */
                newStatus?: (anki.collection.UndoStatus.$Properties|null);

                /** OpChangesAfterUndo counter */
                counter?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an OpChangesAfterUndo. */
            type $Shape = anki.collection.OpChangesAfterUndo.$Properties;
        }
    }

    /** Namespace notetypes. */
    namespace notetypes {

        /**
         * Properties of a NotetypeId.
         * @deprecated Use anki.notetypes.NotetypeId.$Properties instead.
         */
        interface INotetypeId extends anki.notetypes.NotetypeId.$Properties {
        }

        /** Represents a NotetypeId. */
        class NotetypeId {

            /**
             * Constructs a new NotetypeId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.NotetypeId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NotetypeId ntid. */
            ntid: (number|Long);

            /**
             * Creates a new NotetypeId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NotetypeId instance
             */
            static create(properties: anki.notetypes.NotetypeId.$Shape): anki.notetypes.NotetypeId & anki.notetypes.NotetypeId.$Shape;
            static create(properties?: anki.notetypes.NotetypeId.$Properties): anki.notetypes.NotetypeId;

            /**
             * Encodes the specified NotetypeId message. Does not implicitly {@link anki.notetypes.NotetypeId.verify|verify} messages.
             * @param message NotetypeId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.NotetypeId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NotetypeId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.NotetypeId & anki.notetypes.NotetypeId.$Shape} NotetypeId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.NotetypeId & anki.notetypes.NotetypeId.$Shape;
        }

        namespace NotetypeId {

            /** Properties of a NotetypeId. */
            interface $Properties {

                /** NotetypeId ntid */
                ntid?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NotetypeId. */
            type $Shape = anki.notetypes.NotetypeId.$Properties;
        }

        /**
         * Properties of a Notetype.
         * @deprecated Use anki.notetypes.Notetype.$Properties instead.
         */
        interface INotetype extends anki.notetypes.Notetype.$Properties {
        }

        /** Represents a Notetype. */
        class Notetype {

            /**
             * Constructs a new Notetype.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.Notetype.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Notetype id. */
            id: (number|Long);

            /** Notetype name. */
            name: string;

            /** Notetype mtimeSecs. */
            mtimeSecs: (number|Long);

            /** Notetype usn. */
            usn: number;

            /** Notetype config. */
            config?: (anki.notetypes.Notetype.Config.$Properties|null);

            /** Notetype fields. */
            fields: anki.notetypes.Notetype.Field.$Properties[];

            /** Notetype templates. */
            templates: anki.notetypes.Notetype.Template.$Properties[];

            /**
             * Creates a new Notetype instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Notetype instance
             */
            static create(properties: anki.notetypes.Notetype.$Shape): anki.notetypes.Notetype & anki.notetypes.Notetype.$Shape;
            static create(properties?: anki.notetypes.Notetype.$Properties): anki.notetypes.Notetype;

            /**
             * Encodes the specified Notetype message. Does not implicitly {@link anki.notetypes.Notetype.verify|verify} messages.
             * @param message Notetype message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.Notetype.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Notetype message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.Notetype & anki.notetypes.Notetype.$Shape} Notetype
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype & anki.notetypes.Notetype.$Shape;
        }

        namespace Notetype {

            /** Properties of a Notetype. */
            interface $Properties {

                /** Notetype id */
                id?: (number|Long|null);

                /** Notetype name */
                name?: (string|null);

                /** Notetype mtimeSecs */
                mtimeSecs?: (number|Long|null);

                /** Notetype usn */
                usn?: (number|null);

                /** Notetype config */
                config?: (anki.notetypes.Notetype.Config.$Properties|null);

                /** Notetype fields */
                fields?: (anki.notetypes.Notetype.Field.$Properties[]|null);

                /** Notetype templates */
                templates?: (anki.notetypes.Notetype.Template.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Notetype. */
            type $Shape = anki.notetypes.Notetype.$Properties;

            /**
             * Properties of a Config.
             * @deprecated Use anki.notetypes.Notetype.Config.$Properties instead.
             */
            interface IConfig extends anki.notetypes.Notetype.Config.$Properties {
            }

            /** Represents a Config. */
            class Config {

                /**
                 * Constructs a new Config.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.notetypes.Notetype.Config.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Config kind. */
                kind: anki.notetypes.Notetype.Config.Kind;

                /** Config sortFieldIdx. */
                sortFieldIdx: number;

                /** Config css. */
                css: string;

                /** Config targetDeckIdUnused. */
                targetDeckIdUnused: (number|Long);

                /** Config latexPre. */
                latexPre: string;

                /** Config latexPost. */
                latexPost: string;

                /** Config latexSvg. */
                latexSvg: boolean;

                /** Config reqs. */
                reqs: anki.notetypes.Notetype.Config.CardRequirement.$Properties[];

                /** Config originalStockKind. */
                originalStockKind: anki.notetypes.StockNotetype.OriginalStockKind;

                /** Config originalId. */
                originalId?: (number|Long|null);

                /** Config other. */
                other: Uint8Array;

                /**
                 * Creates a new Config instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Config instance
                 */
                static create(properties: anki.notetypes.Notetype.Config.$Shape): anki.notetypes.Notetype.Config & anki.notetypes.Notetype.Config.$Shape;
                static create(properties?: anki.notetypes.Notetype.Config.$Properties): anki.notetypes.Notetype.Config;

                /**
                 * Encodes the specified Config message. Does not implicitly {@link anki.notetypes.Notetype.Config.verify|verify} messages.
                 * @param message Config message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.notetypes.Notetype.Config.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Config message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.notetypes.Notetype.Config & anki.notetypes.Notetype.Config.$Shape} Config
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Config & anki.notetypes.Notetype.Config.$Shape;
            }

            namespace Config {

                /** Properties of a Config. */
                interface $Properties {

                    /** Config kind */
                    kind?: (anki.notetypes.Notetype.Config.Kind|null);

                    /** Config sortFieldIdx */
                    sortFieldIdx?: (number|null);

                    /** Config css */
                    css?: (string|null);

                    /** Config targetDeckIdUnused */
                    targetDeckIdUnused?: (number|Long|null);

                    /** Config latexPre */
                    latexPre?: (string|null);

                    /** Config latexPost */
                    latexPost?: (string|null);

                    /** Config latexSvg */
                    latexSvg?: (boolean|null);

                    /** Config reqs */
                    reqs?: (anki.notetypes.Notetype.Config.CardRequirement.$Properties[]|null);

                    /** Config originalStockKind */
                    originalStockKind?: (anki.notetypes.StockNotetype.OriginalStockKind|null);

                    /** Config originalId */
                    originalId?: (number|Long|null);

                    /** Config other */
                    other?: (Uint8Array|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Config. */
                type $Shape = anki.notetypes.Notetype.Config.$Properties;

                /** Kind enum. */
                enum Kind {

                    /** KIND_NORMAL value */
                    KIND_NORMAL = 0,

                    /** KIND_CLOZE value */
                    KIND_CLOZE = 1
                }

                /**
                 * Properties of a CardRequirement.
                 * @deprecated Use anki.notetypes.Notetype.Config.CardRequirement.$Properties instead.
                 */
                interface ICardRequirement extends anki.notetypes.Notetype.Config.CardRequirement.$Properties {
                }

                /** Represents a CardRequirement. */
                class CardRequirement {

                    /**
                     * Constructs a new CardRequirement.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.notetypes.Notetype.Config.CardRequirement.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** CardRequirement cardOrd. */
                    cardOrd: number;

                    /** CardRequirement kind. */
                    kind: anki.notetypes.Notetype.Config.CardRequirement.Kind;

                    /** CardRequirement fieldOrds. */
                    fieldOrds: number[];

                    /**
                     * Creates a new CardRequirement instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CardRequirement instance
                     */
                    static create(properties: anki.notetypes.Notetype.Config.CardRequirement.$Shape): anki.notetypes.Notetype.Config.CardRequirement & anki.notetypes.Notetype.Config.CardRequirement.$Shape;
                    static create(properties?: anki.notetypes.Notetype.Config.CardRequirement.$Properties): anki.notetypes.Notetype.Config.CardRequirement;

                    /**
                     * Encodes the specified CardRequirement message. Does not implicitly {@link anki.notetypes.Notetype.Config.CardRequirement.verify|verify} messages.
                     * @param message CardRequirement message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.notetypes.Notetype.Config.CardRequirement.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CardRequirement message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.notetypes.Notetype.Config.CardRequirement & anki.notetypes.Notetype.Config.CardRequirement.$Shape} CardRequirement
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Config.CardRequirement & anki.notetypes.Notetype.Config.CardRequirement.$Shape;
                }

                namespace CardRequirement {

                    /** Properties of a CardRequirement. */
                    interface $Properties {

                        /** CardRequirement cardOrd */
                        cardOrd?: (number|null);

                        /** CardRequirement kind */
                        kind?: (anki.notetypes.Notetype.Config.CardRequirement.Kind|null);

                        /** CardRequirement fieldOrds */
                        fieldOrds?: (number[]|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a CardRequirement. */
                    type $Shape = anki.notetypes.Notetype.Config.CardRequirement.$Properties;

                    /** Kind enum. */
                    enum Kind {

                        /** KIND_NONE value */
                        KIND_NONE = 0,

                        /** KIND_ANY value */
                        KIND_ANY = 1,

                        /** KIND_ALL value */
                        KIND_ALL = 2
                    }
                }
            }

            /**
             * Properties of a Field.
             * @deprecated Use anki.notetypes.Notetype.Field.$Properties instead.
             */
            interface IField extends anki.notetypes.Notetype.Field.$Properties {
            }

            /** Represents a Field. */
            class Field {

                /**
                 * Constructs a new Field.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.notetypes.Notetype.Field.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Field ord. */
                ord?: (anki.generic.UInt32.$Properties|null);

                /** Field name. */
                name: string;

                /** Field config. */
                config?: (anki.notetypes.Notetype.Field.Config.$Properties|null);

                /**
                 * Creates a new Field instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Field instance
                 */
                static create(properties: anki.notetypes.Notetype.Field.$Shape): anki.notetypes.Notetype.Field & anki.notetypes.Notetype.Field.$Shape;
                static create(properties?: anki.notetypes.Notetype.Field.$Properties): anki.notetypes.Notetype.Field;

                /**
                 * Encodes the specified Field message. Does not implicitly {@link anki.notetypes.Notetype.Field.verify|verify} messages.
                 * @param message Field message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.notetypes.Notetype.Field.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Field message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.notetypes.Notetype.Field & anki.notetypes.Notetype.Field.$Shape} Field
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Field & anki.notetypes.Notetype.Field.$Shape;
            }

            namespace Field {

                /** Properties of a Field. */
                interface $Properties {

                    /** Field ord */
                    ord?: (anki.generic.UInt32.$Properties|null);

                    /** Field name */
                    name?: (string|null);

                    /** Field config */
                    config?: (anki.notetypes.Notetype.Field.Config.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Field. */
                type $Shape = anki.notetypes.Notetype.Field.$Properties;

                /**
                 * Properties of a Config.
                 * @deprecated Use anki.notetypes.Notetype.Field.Config.$Properties instead.
                 */
                interface IConfig extends anki.notetypes.Notetype.Field.Config.$Properties {
                }

                /** Represents a Config. */
                class Config {

                    /**
                     * Constructs a new Config.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.notetypes.Notetype.Field.Config.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Config sticky. */
                    sticky: boolean;

                    /** Config rtl. */
                    rtl: boolean;

                    /** Config fontName. */
                    fontName: string;

                    /** Config fontSize. */
                    fontSize: number;

                    /** Config description. */
                    description: string;

                    /** Config plainText. */
                    plainText: boolean;

                    /** Config collapsed. */
                    collapsed: boolean;

                    /** Config excludeFromSearch. */
                    excludeFromSearch: boolean;

                    /** Config id. */
                    id?: (number|Long|null);

                    /** Config tag. */
                    tag?: (number|null);

                    /** Config preventDeletion. */
                    preventDeletion: boolean;

                    /** Config other. */
                    other: Uint8Array;

                    /**
                     * Creates a new Config instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Config instance
                     */
                    static create(properties: anki.notetypes.Notetype.Field.Config.$Shape): anki.notetypes.Notetype.Field.Config & anki.notetypes.Notetype.Field.Config.$Shape;
                    static create(properties?: anki.notetypes.Notetype.Field.Config.$Properties): anki.notetypes.Notetype.Field.Config;

                    /**
                     * Encodes the specified Config message. Does not implicitly {@link anki.notetypes.Notetype.Field.Config.verify|verify} messages.
                     * @param message Config message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.notetypes.Notetype.Field.Config.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Config message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.notetypes.Notetype.Field.Config & anki.notetypes.Notetype.Field.Config.$Shape} Config
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Field.Config & anki.notetypes.Notetype.Field.Config.$Shape;
                }

                namespace Config {

                    /** Properties of a Config. */
                    interface $Properties {

                        /** Config sticky */
                        sticky?: (boolean|null);

                        /** Config rtl */
                        rtl?: (boolean|null);

                        /** Config fontName */
                        fontName?: (string|null);

                        /** Config fontSize */
                        fontSize?: (number|null);

                        /** Config description */
                        description?: (string|null);

                        /** Config plainText */
                        plainText?: (boolean|null);

                        /** Config collapsed */
                        collapsed?: (boolean|null);

                        /** Config excludeFromSearch */
                        excludeFromSearch?: (boolean|null);

                        /** Config id */
                        id?: (number|Long|null);

                        /** Config tag */
                        tag?: (number|null);

                        /** Config preventDeletion */
                        preventDeletion?: (boolean|null);

                        /** Config other */
                        other?: (Uint8Array|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a Config. */
                    type $Shape = anki.notetypes.Notetype.Field.Config.$Properties;
                }
            }

            /**
             * Properties of a Template.
             * @deprecated Use anki.notetypes.Notetype.Template.$Properties instead.
             */
            interface ITemplate extends anki.notetypes.Notetype.Template.$Properties {
            }

            /** Represents a Template. */
            class Template {

                /**
                 * Constructs a new Template.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.notetypes.Notetype.Template.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Template ord. */
                ord?: (anki.generic.UInt32.$Properties|null);

                /** Template name. */
                name: string;

                /** Template mtimeSecs. */
                mtimeSecs: (number|Long);

                /** Template usn. */
                usn: number;

                /** Template config. */
                config?: (anki.notetypes.Notetype.Template.Config.$Properties|null);

                /**
                 * Creates a new Template instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Template instance
                 */
                static create(properties: anki.notetypes.Notetype.Template.$Shape): anki.notetypes.Notetype.Template & anki.notetypes.Notetype.Template.$Shape;
                static create(properties?: anki.notetypes.Notetype.Template.$Properties): anki.notetypes.Notetype.Template;

                /**
                 * Encodes the specified Template message. Does not implicitly {@link anki.notetypes.Notetype.Template.verify|verify} messages.
                 * @param message Template message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.notetypes.Notetype.Template.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Template message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.notetypes.Notetype.Template & anki.notetypes.Notetype.Template.$Shape} Template
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Template & anki.notetypes.Notetype.Template.$Shape;
            }

            namespace Template {

                /** Properties of a Template. */
                interface $Properties {

                    /** Template ord */
                    ord?: (anki.generic.UInt32.$Properties|null);

                    /** Template name */
                    name?: (string|null);

                    /** Template mtimeSecs */
                    mtimeSecs?: (number|Long|null);

                    /** Template usn */
                    usn?: (number|null);

                    /** Template config */
                    config?: (anki.notetypes.Notetype.Template.Config.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Template. */
                type $Shape = anki.notetypes.Notetype.Template.$Properties;

                /**
                 * Properties of a Config.
                 * @deprecated Use anki.notetypes.Notetype.Template.Config.$Properties instead.
                 */
                interface IConfig extends anki.notetypes.Notetype.Template.Config.$Properties {
                }

                /** Represents a Config. */
                class Config {

                    /**
                     * Constructs a new Config.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.notetypes.Notetype.Template.Config.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Config qFormat. */
                    qFormat: string;

                    /** Config aFormat. */
                    aFormat: string;

                    /** Config qFormatBrowser. */
                    qFormatBrowser: string;

                    /** Config aFormatBrowser. */
                    aFormatBrowser: string;

                    /** Config targetDeckId. */
                    targetDeckId: (number|Long);

                    /** Config browserFontName. */
                    browserFontName: string;

                    /** Config browserFontSize. */
                    browserFontSize: number;

                    /** Config id. */
                    id?: (number|Long|null);

                    /** Config other. */
                    other: Uint8Array;

                    /**
                     * Creates a new Config instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Config instance
                     */
                    static create(properties: anki.notetypes.Notetype.Template.Config.$Shape): anki.notetypes.Notetype.Template.Config & anki.notetypes.Notetype.Template.Config.$Shape;
                    static create(properties?: anki.notetypes.Notetype.Template.Config.$Properties): anki.notetypes.Notetype.Template.Config;

                    /**
                     * Encodes the specified Config message. Does not implicitly {@link anki.notetypes.Notetype.Template.Config.verify|verify} messages.
                     * @param message Config message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.notetypes.Notetype.Template.Config.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Config message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.notetypes.Notetype.Template.Config & anki.notetypes.Notetype.Template.Config.$Shape} Config
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.Notetype.Template.Config & anki.notetypes.Notetype.Template.Config.$Shape;
                }

                namespace Config {

                    /** Properties of a Config. */
                    interface $Properties {

                        /** Config qFormat */
                        qFormat?: (string|null);

                        /** Config aFormat */
                        aFormat?: (string|null);

                        /** Config qFormatBrowser */
                        qFormatBrowser?: (string|null);

                        /** Config aFormatBrowser */
                        aFormatBrowser?: (string|null);

                        /** Config targetDeckId */
                        targetDeckId?: (number|Long|null);

                        /** Config browserFontName */
                        browserFontName?: (string|null);

                        /** Config browserFontSize */
                        browserFontSize?: (number|null);

                        /** Config id */
                        id?: (number|Long|null);

                        /** Config other */
                        other?: (Uint8Array|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a Config. */
                    type $Shape = anki.notetypes.Notetype.Template.Config.$Properties;
                }
            }
        }

        /**
         * Properties of an AddOrUpdateNotetypeRequest.
         * @deprecated Use anki.notetypes.AddOrUpdateNotetypeRequest.$Properties instead.
         */
        interface IAddOrUpdateNotetypeRequest extends anki.notetypes.AddOrUpdateNotetypeRequest.$Properties {
        }

        /** Represents an AddOrUpdateNotetypeRequest. */
        class AddOrUpdateNotetypeRequest {

            /**
             * Constructs a new AddOrUpdateNotetypeRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.AddOrUpdateNotetypeRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** AddOrUpdateNotetypeRequest json. */
            json: Uint8Array;

            /** AddOrUpdateNotetypeRequest preserveUsnAndMtime. */
            preserveUsnAndMtime: boolean;

            /** AddOrUpdateNotetypeRequest skipChecks. */
            skipChecks: boolean;

            /**
             * Creates a new AddOrUpdateNotetypeRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AddOrUpdateNotetypeRequest instance
             */
            static create(properties: anki.notetypes.AddOrUpdateNotetypeRequest.$Shape): anki.notetypes.AddOrUpdateNotetypeRequest & anki.notetypes.AddOrUpdateNotetypeRequest.$Shape;
            static create(properties?: anki.notetypes.AddOrUpdateNotetypeRequest.$Properties): anki.notetypes.AddOrUpdateNotetypeRequest;

            /**
             * Encodes the specified AddOrUpdateNotetypeRequest message. Does not implicitly {@link anki.notetypes.AddOrUpdateNotetypeRequest.verify|verify} messages.
             * @param message AddOrUpdateNotetypeRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.AddOrUpdateNotetypeRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an AddOrUpdateNotetypeRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.AddOrUpdateNotetypeRequest & anki.notetypes.AddOrUpdateNotetypeRequest.$Shape} AddOrUpdateNotetypeRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.AddOrUpdateNotetypeRequest & anki.notetypes.AddOrUpdateNotetypeRequest.$Shape;
        }

        namespace AddOrUpdateNotetypeRequest {

            /** Properties of an AddOrUpdateNotetypeRequest. */
            interface $Properties {

                /** AddOrUpdateNotetypeRequest json */
                json?: (Uint8Array|null);

                /** AddOrUpdateNotetypeRequest preserveUsnAndMtime */
                preserveUsnAndMtime?: (boolean|null);

                /** AddOrUpdateNotetypeRequest skipChecks */
                skipChecks?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an AddOrUpdateNotetypeRequest. */
            type $Shape = anki.notetypes.AddOrUpdateNotetypeRequest.$Properties;
        }

        /**
         * Properties of a StockNotetype.
         * @deprecated Use anki.notetypes.StockNotetype.$Properties instead.
         */
        interface IStockNotetype extends anki.notetypes.StockNotetype.$Properties {
        }

        /** Represents a StockNotetype. */
        class StockNotetype {

            /**
             * Constructs a new StockNotetype.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.StockNotetype.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** StockNotetype kind. */
            kind: anki.notetypes.StockNotetype.Kind;

            /**
             * Creates a new StockNotetype instance using the specified properties.
             * @param [properties] Properties to set
             * @returns StockNotetype instance
             */
            static create(properties: anki.notetypes.StockNotetype.$Shape): anki.notetypes.StockNotetype & anki.notetypes.StockNotetype.$Shape;
            static create(properties?: anki.notetypes.StockNotetype.$Properties): anki.notetypes.StockNotetype;

            /**
             * Encodes the specified StockNotetype message. Does not implicitly {@link anki.notetypes.StockNotetype.verify|verify} messages.
             * @param message StockNotetype message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.StockNotetype.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a StockNotetype message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.StockNotetype & anki.notetypes.StockNotetype.$Shape} StockNotetype
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.StockNotetype & anki.notetypes.StockNotetype.$Shape;
        }

        namespace StockNotetype {

            /** Properties of a StockNotetype. */
            interface $Properties {

                /** StockNotetype kind */
                kind?: (anki.notetypes.StockNotetype.Kind|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a StockNotetype. */
            type $Shape = anki.notetypes.StockNotetype.$Properties;

            /** Kind enum. */
            enum Kind {

                /** KIND_BASIC value */
                KIND_BASIC = 0,

                /** KIND_BASIC_AND_REVERSED value */
                KIND_BASIC_AND_REVERSED = 1,

                /** KIND_BASIC_OPTIONAL_REVERSED value */
                KIND_BASIC_OPTIONAL_REVERSED = 2,

                /** KIND_BASIC_TYPING value */
                KIND_BASIC_TYPING = 3,

                /** KIND_CLOZE value */
                KIND_CLOZE = 4,

                /** KIND_IMAGE_OCCLUSION value */
                KIND_IMAGE_OCCLUSION = 5
            }

            /** OriginalStockKind enum. */
            enum OriginalStockKind {

                /** ORIGINAL_STOCK_KIND_UNKNOWN value */
                ORIGINAL_STOCK_KIND_UNKNOWN = 0,

                /** ORIGINAL_STOCK_KIND_BASIC value */
                ORIGINAL_STOCK_KIND_BASIC = 1,

                /** ORIGINAL_STOCK_KIND_BASIC_AND_REVERSED value */
                ORIGINAL_STOCK_KIND_BASIC_AND_REVERSED = 2,

                /** ORIGINAL_STOCK_KIND_BASIC_OPTIONAL_REVERSED value */
                ORIGINAL_STOCK_KIND_BASIC_OPTIONAL_REVERSED = 3,

                /** ORIGINAL_STOCK_KIND_BASIC_TYPING value */
                ORIGINAL_STOCK_KIND_BASIC_TYPING = 4,

                /** ORIGINAL_STOCK_KIND_CLOZE value */
                ORIGINAL_STOCK_KIND_CLOZE = 5,

                /** ORIGINAL_STOCK_KIND_IMAGE_OCCLUSION value */
                ORIGINAL_STOCK_KIND_IMAGE_OCCLUSION = 6
            }
        }

        /**
         * Properties of a NotetypeNames.
         * @deprecated Use anki.notetypes.NotetypeNames.$Properties instead.
         */
        interface INotetypeNames extends anki.notetypes.NotetypeNames.$Properties {
        }

        /** Represents a NotetypeNames. */
        class NotetypeNames {

            /**
             * Constructs a new NotetypeNames.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.NotetypeNames.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NotetypeNames entries. */
            entries: anki.notetypes.NotetypeNameId.$Properties[];

            /**
             * Creates a new NotetypeNames instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NotetypeNames instance
             */
            static create(properties: anki.notetypes.NotetypeNames.$Shape): anki.notetypes.NotetypeNames & anki.notetypes.NotetypeNames.$Shape;
            static create(properties?: anki.notetypes.NotetypeNames.$Properties): anki.notetypes.NotetypeNames;

            /**
             * Encodes the specified NotetypeNames message. Does not implicitly {@link anki.notetypes.NotetypeNames.verify|verify} messages.
             * @param message NotetypeNames message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.NotetypeNames.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NotetypeNames message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.NotetypeNames & anki.notetypes.NotetypeNames.$Shape} NotetypeNames
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.NotetypeNames & anki.notetypes.NotetypeNames.$Shape;
        }

        namespace NotetypeNames {

            /** Properties of a NotetypeNames. */
            interface $Properties {

                /** NotetypeNames entries */
                entries?: (anki.notetypes.NotetypeNameId.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NotetypeNames. */
            type $Shape = anki.notetypes.NotetypeNames.$Properties;
        }

        /**
         * Properties of a NotetypeUseCounts.
         * @deprecated Use anki.notetypes.NotetypeUseCounts.$Properties instead.
         */
        interface INotetypeUseCounts extends anki.notetypes.NotetypeUseCounts.$Properties {
        }

        /** Represents a NotetypeUseCounts. */
        class NotetypeUseCounts {

            /**
             * Constructs a new NotetypeUseCounts.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.NotetypeUseCounts.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NotetypeUseCounts entries. */
            entries: anki.notetypes.NotetypeNameIdUseCount.$Properties[];

            /**
             * Creates a new NotetypeUseCounts instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NotetypeUseCounts instance
             */
            static create(properties: anki.notetypes.NotetypeUseCounts.$Shape): anki.notetypes.NotetypeUseCounts & anki.notetypes.NotetypeUseCounts.$Shape;
            static create(properties?: anki.notetypes.NotetypeUseCounts.$Properties): anki.notetypes.NotetypeUseCounts;

            /**
             * Encodes the specified NotetypeUseCounts message. Does not implicitly {@link anki.notetypes.NotetypeUseCounts.verify|verify} messages.
             * @param message NotetypeUseCounts message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.NotetypeUseCounts.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NotetypeUseCounts message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.NotetypeUseCounts & anki.notetypes.NotetypeUseCounts.$Shape} NotetypeUseCounts
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.NotetypeUseCounts & anki.notetypes.NotetypeUseCounts.$Shape;
        }

        namespace NotetypeUseCounts {

            /** Properties of a NotetypeUseCounts. */
            interface $Properties {

                /** NotetypeUseCounts entries */
                entries?: (anki.notetypes.NotetypeNameIdUseCount.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NotetypeUseCounts. */
            type $Shape = anki.notetypes.NotetypeUseCounts.$Properties;
        }

        /**
         * Properties of a NotetypeNameId.
         * @deprecated Use anki.notetypes.NotetypeNameId.$Properties instead.
         */
        interface INotetypeNameId extends anki.notetypes.NotetypeNameId.$Properties {
        }

        /** Represents a NotetypeNameId. */
        class NotetypeNameId {

            /**
             * Constructs a new NotetypeNameId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.NotetypeNameId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NotetypeNameId id. */
            id: (number|Long);

            /** NotetypeNameId name. */
            name: string;

            /**
             * Creates a new NotetypeNameId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NotetypeNameId instance
             */
            static create(properties: anki.notetypes.NotetypeNameId.$Shape): anki.notetypes.NotetypeNameId & anki.notetypes.NotetypeNameId.$Shape;
            static create(properties?: anki.notetypes.NotetypeNameId.$Properties): anki.notetypes.NotetypeNameId;

            /**
             * Encodes the specified NotetypeNameId message. Does not implicitly {@link anki.notetypes.NotetypeNameId.verify|verify} messages.
             * @param message NotetypeNameId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.NotetypeNameId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NotetypeNameId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.NotetypeNameId & anki.notetypes.NotetypeNameId.$Shape} NotetypeNameId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.NotetypeNameId & anki.notetypes.NotetypeNameId.$Shape;
        }

        namespace NotetypeNameId {

            /** Properties of a NotetypeNameId. */
            interface $Properties {

                /** NotetypeNameId id */
                id?: (number|Long|null);

                /** NotetypeNameId name */
                name?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NotetypeNameId. */
            type $Shape = anki.notetypes.NotetypeNameId.$Properties;
        }

        /**
         * Properties of a NotetypeNameIdUseCount.
         * @deprecated Use anki.notetypes.NotetypeNameIdUseCount.$Properties instead.
         */
        interface INotetypeNameIdUseCount extends anki.notetypes.NotetypeNameIdUseCount.$Properties {
        }

        /** Represents a NotetypeNameIdUseCount. */
        class NotetypeNameIdUseCount {

            /**
             * Constructs a new NotetypeNameIdUseCount.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.NotetypeNameIdUseCount.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NotetypeNameIdUseCount id. */
            id: (number|Long);

            /** NotetypeNameIdUseCount name. */
            name: string;

            /** NotetypeNameIdUseCount useCount. */
            useCount: number;

            /**
             * Creates a new NotetypeNameIdUseCount instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NotetypeNameIdUseCount instance
             */
            static create(properties: anki.notetypes.NotetypeNameIdUseCount.$Shape): anki.notetypes.NotetypeNameIdUseCount & anki.notetypes.NotetypeNameIdUseCount.$Shape;
            static create(properties?: anki.notetypes.NotetypeNameIdUseCount.$Properties): anki.notetypes.NotetypeNameIdUseCount;

            /**
             * Encodes the specified NotetypeNameIdUseCount message. Does not implicitly {@link anki.notetypes.NotetypeNameIdUseCount.verify|verify} messages.
             * @param message NotetypeNameIdUseCount message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.NotetypeNameIdUseCount.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NotetypeNameIdUseCount message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.NotetypeNameIdUseCount & anki.notetypes.NotetypeNameIdUseCount.$Shape} NotetypeNameIdUseCount
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.NotetypeNameIdUseCount & anki.notetypes.NotetypeNameIdUseCount.$Shape;
        }

        namespace NotetypeNameIdUseCount {

            /** Properties of a NotetypeNameIdUseCount. */
            interface $Properties {

                /** NotetypeNameIdUseCount id */
                id?: (number|Long|null);

                /** NotetypeNameIdUseCount name */
                name?: (string|null);

                /** NotetypeNameIdUseCount useCount */
                useCount?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NotetypeNameIdUseCount. */
            type $Shape = anki.notetypes.NotetypeNameIdUseCount.$Properties;
        }

        /**
         * Properties of a GetChangeNotetypeInfoRequest.
         * @deprecated Use anki.notetypes.GetChangeNotetypeInfoRequest.$Properties instead.
         */
        interface IGetChangeNotetypeInfoRequest extends anki.notetypes.GetChangeNotetypeInfoRequest.$Properties {
        }

        /** Represents a GetChangeNotetypeInfoRequest. */
        class GetChangeNotetypeInfoRequest {

            /**
             * Constructs a new GetChangeNotetypeInfoRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.GetChangeNotetypeInfoRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GetChangeNotetypeInfoRequest oldNotetypeId. */
            oldNotetypeId: (number|Long);

            /** GetChangeNotetypeInfoRequest newNotetypeId. */
            newNotetypeId: (number|Long);

            /**
             * Creates a new GetChangeNotetypeInfoRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetChangeNotetypeInfoRequest instance
             */
            static create(properties: anki.notetypes.GetChangeNotetypeInfoRequest.$Shape): anki.notetypes.GetChangeNotetypeInfoRequest & anki.notetypes.GetChangeNotetypeInfoRequest.$Shape;
            static create(properties?: anki.notetypes.GetChangeNotetypeInfoRequest.$Properties): anki.notetypes.GetChangeNotetypeInfoRequest;

            /**
             * Encodes the specified GetChangeNotetypeInfoRequest message. Does not implicitly {@link anki.notetypes.GetChangeNotetypeInfoRequest.verify|verify} messages.
             * @param message GetChangeNotetypeInfoRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.GetChangeNotetypeInfoRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetChangeNotetypeInfoRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.GetChangeNotetypeInfoRequest & anki.notetypes.GetChangeNotetypeInfoRequest.$Shape} GetChangeNotetypeInfoRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.GetChangeNotetypeInfoRequest & anki.notetypes.GetChangeNotetypeInfoRequest.$Shape;
        }

        namespace GetChangeNotetypeInfoRequest {

            /** Properties of a GetChangeNotetypeInfoRequest. */
            interface $Properties {

                /** GetChangeNotetypeInfoRequest oldNotetypeId */
                oldNotetypeId?: (number|Long|null);

                /** GetChangeNotetypeInfoRequest newNotetypeId */
                newNotetypeId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GetChangeNotetypeInfoRequest. */
            type $Shape = anki.notetypes.GetChangeNotetypeInfoRequest.$Properties;
        }

        /**
         * Properties of a ChangeNotetypeRequest.
         * @deprecated Use anki.notetypes.ChangeNotetypeRequest.$Properties instead.
         */
        interface IChangeNotetypeRequest extends anki.notetypes.ChangeNotetypeRequest.$Properties {
        }

        /** Represents a ChangeNotetypeRequest. */
        class ChangeNotetypeRequest {

            /**
             * Constructs a new ChangeNotetypeRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.ChangeNotetypeRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ChangeNotetypeRequest noteIds. */
            noteIds: (number|Long)[];

            /** ChangeNotetypeRequest newFields. */
            newFields: number[];

            /** ChangeNotetypeRequest newTemplates. */
            newTemplates: number[];

            /** ChangeNotetypeRequest oldNotetypeId. */
            oldNotetypeId: (number|Long);

            /** ChangeNotetypeRequest newNotetypeId. */
            newNotetypeId: (number|Long);

            /** ChangeNotetypeRequest currentSchema. */
            currentSchema: (number|Long);

            /** ChangeNotetypeRequest oldNotetypeName. */
            oldNotetypeName: string;

            /** ChangeNotetypeRequest isCloze. */
            isCloze: boolean;

            /**
             * Creates a new ChangeNotetypeRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ChangeNotetypeRequest instance
             */
            static create(properties: anki.notetypes.ChangeNotetypeRequest.$Shape): anki.notetypes.ChangeNotetypeRequest & anki.notetypes.ChangeNotetypeRequest.$Shape;
            static create(properties?: anki.notetypes.ChangeNotetypeRequest.$Properties): anki.notetypes.ChangeNotetypeRequest;

            /**
             * Encodes the specified ChangeNotetypeRequest message. Does not implicitly {@link anki.notetypes.ChangeNotetypeRequest.verify|verify} messages.
             * @param message ChangeNotetypeRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.ChangeNotetypeRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ChangeNotetypeRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.ChangeNotetypeRequest & anki.notetypes.ChangeNotetypeRequest.$Shape} ChangeNotetypeRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.ChangeNotetypeRequest & anki.notetypes.ChangeNotetypeRequest.$Shape;
        }

        namespace ChangeNotetypeRequest {

            /** Properties of a ChangeNotetypeRequest. */
            interface $Properties {

                /** ChangeNotetypeRequest noteIds */
                noteIds?: ((number|Long)[]|null);

                /** ChangeNotetypeRequest newFields */
                newFields?: (number[]|null);

                /** ChangeNotetypeRequest newTemplates */
                newTemplates?: (number[]|null);

                /** ChangeNotetypeRequest oldNotetypeId */
                oldNotetypeId?: (number|Long|null);

                /** ChangeNotetypeRequest newNotetypeId */
                newNotetypeId?: (number|Long|null);

                /** ChangeNotetypeRequest currentSchema */
                currentSchema?: (number|Long|null);

                /** ChangeNotetypeRequest oldNotetypeName */
                oldNotetypeName?: (string|null);

                /** ChangeNotetypeRequest isCloze */
                isCloze?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ChangeNotetypeRequest. */
            type $Shape = anki.notetypes.ChangeNotetypeRequest.$Properties;
        }

        /**
         * Properties of a ChangeNotetypeInfo.
         * @deprecated Use anki.notetypes.ChangeNotetypeInfo.$Properties instead.
         */
        interface IChangeNotetypeInfo extends anki.notetypes.ChangeNotetypeInfo.$Properties {
        }

        /** Represents a ChangeNotetypeInfo. */
        class ChangeNotetypeInfo {

            /**
             * Constructs a new ChangeNotetypeInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.notetypes.ChangeNotetypeInfo.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ChangeNotetypeInfo oldFieldNames. */
            oldFieldNames: string[];

            /** ChangeNotetypeInfo oldTemplateNames. */
            oldTemplateNames: string[];

            /** ChangeNotetypeInfo newFieldNames. */
            newFieldNames: string[];

            /** ChangeNotetypeInfo newTemplateNames. */
            newTemplateNames: string[];

            /** ChangeNotetypeInfo input. */
            input?: (anki.notetypes.ChangeNotetypeRequest.$Properties|null);

            /** ChangeNotetypeInfo oldNotetypeName. */
            oldNotetypeName: string;

            /**
             * Creates a new ChangeNotetypeInfo instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ChangeNotetypeInfo instance
             */
            static create(properties: anki.notetypes.ChangeNotetypeInfo.$Shape): anki.notetypes.ChangeNotetypeInfo & anki.notetypes.ChangeNotetypeInfo.$Shape;
            static create(properties?: anki.notetypes.ChangeNotetypeInfo.$Properties): anki.notetypes.ChangeNotetypeInfo;

            /**
             * Encodes the specified ChangeNotetypeInfo message. Does not implicitly {@link anki.notetypes.ChangeNotetypeInfo.verify|verify} messages.
             * @param message ChangeNotetypeInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.notetypes.ChangeNotetypeInfo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ChangeNotetypeInfo message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.notetypes.ChangeNotetypeInfo & anki.notetypes.ChangeNotetypeInfo.$Shape} ChangeNotetypeInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.notetypes.ChangeNotetypeInfo & anki.notetypes.ChangeNotetypeInfo.$Shape;
        }

        namespace ChangeNotetypeInfo {

            /** Properties of a ChangeNotetypeInfo. */
            interface $Properties {

                /** ChangeNotetypeInfo oldFieldNames */
                oldFieldNames?: (string[]|null);

                /** ChangeNotetypeInfo oldTemplateNames */
                oldTemplateNames?: (string[]|null);

                /** ChangeNotetypeInfo newFieldNames */
                newFieldNames?: (string[]|null);

                /** ChangeNotetypeInfo newTemplateNames */
                newTemplateNames?: (string[]|null);

                /** ChangeNotetypeInfo input */
                input?: (anki.notetypes.ChangeNotetypeRequest.$Properties|null);

                /** ChangeNotetypeInfo oldNotetypeName */
                oldNotetypeName?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ChangeNotetypeInfo. */
            type $Shape = anki.notetypes.ChangeNotetypeInfo.$Properties;
        }
    }

    /** Namespace generic. */
    namespace generic {

        /**
         * Properties of an Empty.
         * @deprecated Use anki.generic.Empty.$Properties instead.
         */
        interface IEmpty extends anki.generic.Empty.$Properties {
        }

        /** Represents an Empty. */
        class Empty {

            /**
             * Constructs a new Empty.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.Empty.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /**
             * Creates a new Empty instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Empty instance
             */
            static create(properties: anki.generic.Empty.$Shape): anki.generic.Empty & anki.generic.Empty.$Shape;
            static create(properties?: anki.generic.Empty.$Properties): anki.generic.Empty;

            /**
             * Encodes the specified Empty message. Does not implicitly {@link anki.generic.Empty.verify|verify} messages.
             * @param message Empty message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.Empty.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Empty message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.Empty & anki.generic.Empty.$Shape} Empty
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.Empty & anki.generic.Empty.$Shape;
        }

        namespace Empty {

            /** Properties of an Empty. */
            interface $Properties {

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an Empty. */
            type $Shape = anki.generic.Empty.$Properties;
        }

        /**
         * Properties of an Int32.
         * @deprecated Use anki.generic.Int32.$Properties instead.
         */
        interface IInt32 extends anki.generic.Int32.$Properties {
        }

        /** Represents an Int32. */
        class Int32 {

            /**
             * Constructs a new Int32.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.Int32.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Int32 val. */
            val: number;

            /**
             * Creates a new Int32 instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Int32 instance
             */
            static create(properties: anki.generic.Int32.$Shape): anki.generic.Int32 & anki.generic.Int32.$Shape;
            static create(properties?: anki.generic.Int32.$Properties): anki.generic.Int32;

            /**
             * Encodes the specified Int32 message. Does not implicitly {@link anki.generic.Int32.verify|verify} messages.
             * @param message Int32 message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.Int32.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Int32 message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.Int32 & anki.generic.Int32.$Shape} Int32
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.Int32 & anki.generic.Int32.$Shape;
        }

        namespace Int32 {

            /** Properties of an Int32. */
            interface $Properties {

                /** Int32 val */
                val?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an Int32. */
            type $Shape = anki.generic.Int32.$Properties;
        }

        /**
         * Properties of a UInt32.
         * @deprecated Use anki.generic.UInt32.$Properties instead.
         */
        interface IUInt32 extends anki.generic.UInt32.$Properties {
        }

        /** Represents a UInt32. */
        class UInt32 {

            /**
             * Constructs a new UInt32.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.UInt32.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UInt32 val. */
            val: number;

            /**
             * Creates a new UInt32 instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UInt32 instance
             */
            static create(properties: anki.generic.UInt32.$Shape): anki.generic.UInt32 & anki.generic.UInt32.$Shape;
            static create(properties?: anki.generic.UInt32.$Properties): anki.generic.UInt32;

            /**
             * Encodes the specified UInt32 message. Does not implicitly {@link anki.generic.UInt32.verify|verify} messages.
             * @param message UInt32 message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.UInt32.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a UInt32 message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.UInt32 & anki.generic.UInt32.$Shape} UInt32
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.UInt32 & anki.generic.UInt32.$Shape;
        }

        namespace UInt32 {

            /** Properties of a UInt32. */
            interface $Properties {

                /** UInt32 val */
                val?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a UInt32. */
            type $Shape = anki.generic.UInt32.$Properties;
        }

        /**
         * Properties of an Int64.
         * @deprecated Use anki.generic.Int64.$Properties instead.
         */
        interface IInt64 extends anki.generic.Int64.$Properties {
        }

        /** Represents an Int64. */
        class Int64 {

            /**
             * Constructs a new Int64.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.Int64.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Int64 val. */
            val: (number|Long);

            /**
             * Creates a new Int64 instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Int64 instance
             */
            static create(properties: anki.generic.Int64.$Shape): anki.generic.Int64 & anki.generic.Int64.$Shape;
            static create(properties?: anki.generic.Int64.$Properties): anki.generic.Int64;

            /**
             * Encodes the specified Int64 message. Does not implicitly {@link anki.generic.Int64.verify|verify} messages.
             * @param message Int64 message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.Int64.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Int64 message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.Int64 & anki.generic.Int64.$Shape} Int64
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.Int64 & anki.generic.Int64.$Shape;
        }

        namespace Int64 {

            /** Properties of an Int64. */
            interface $Properties {

                /** Int64 val */
                val?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an Int64. */
            type $Shape = anki.generic.Int64.$Properties;
        }

        /**
         * Properties of a String.
         * @deprecated Use anki.generic.String.$Properties instead.
         */
        interface IString extends anki.generic.String.$Properties {
        }

        /** Represents a String. */
        class String {

            /**
             * Constructs a new String.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.String.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** String val. */
            val: string;

            /**
             * Creates a new String instance using the specified properties.
             * @param [properties] Properties to set
             * @returns String instance
             */
            static create(properties: anki.generic.String.$Shape): anki.generic.String & anki.generic.String.$Shape;
            static create(properties?: anki.generic.String.$Properties): anki.generic.String;

            /**
             * Encodes the specified String message. Does not implicitly {@link anki.generic.String.verify|verify} messages.
             * @param message String message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.String.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a String message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.String & anki.generic.String.$Shape} String
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.String & anki.generic.String.$Shape;
        }

        namespace String {

            /** Properties of a String. */
            interface $Properties {

                /** String val */
                val?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a String. */
            type $Shape = anki.generic.String.$Properties;
        }

        /**
         * Properties of a Json.
         * @deprecated Use anki.generic.Json.$Properties instead.
         */
        interface IJson extends anki.generic.Json.$Properties {
        }

        /** Represents a Json. */
        class Json {

            /**
             * Constructs a new Json.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.Json.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Json json. */
            json: Uint8Array;

            /**
             * Creates a new Json instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Json instance
             */
            static create(properties: anki.generic.Json.$Shape): anki.generic.Json & anki.generic.Json.$Shape;
            static create(properties?: anki.generic.Json.$Properties): anki.generic.Json;

            /**
             * Encodes the specified Json message. Does not implicitly {@link anki.generic.Json.verify|verify} messages.
             * @param message Json message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.Json.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Json message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.Json & anki.generic.Json.$Shape} Json
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.Json & anki.generic.Json.$Shape;
        }

        namespace Json {

            /** Properties of a Json. */
            interface $Properties {

                /** Json json */
                json?: (Uint8Array|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Json. */
            type $Shape = anki.generic.Json.$Properties;
        }

        /**
         * Properties of a Bool.
         * @deprecated Use anki.generic.Bool.$Properties instead.
         */
        interface IBool extends anki.generic.Bool.$Properties {
        }

        /** Represents a Bool. */
        class Bool {

            /**
             * Constructs a new Bool.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.Bool.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Bool val. */
            val: boolean;

            /**
             * Creates a new Bool instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Bool instance
             */
            static create(properties: anki.generic.Bool.$Shape): anki.generic.Bool & anki.generic.Bool.$Shape;
            static create(properties?: anki.generic.Bool.$Properties): anki.generic.Bool;

            /**
             * Encodes the specified Bool message. Does not implicitly {@link anki.generic.Bool.verify|verify} messages.
             * @param message Bool message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.Bool.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Bool message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.Bool & anki.generic.Bool.$Shape} Bool
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.Bool & anki.generic.Bool.$Shape;
        }

        namespace Bool {

            /** Properties of a Bool. */
            interface $Properties {

                /** Bool val */
                val?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Bool. */
            type $Shape = anki.generic.Bool.$Properties;
        }

        /**
         * Properties of a StringList.
         * @deprecated Use anki.generic.StringList.$Properties instead.
         */
        interface IStringList extends anki.generic.StringList.$Properties {
        }

        /** Represents a StringList. */
        class StringList {

            /**
             * Constructs a new StringList.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.generic.StringList.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** StringList vals. */
            vals: string[];

            /**
             * Creates a new StringList instance using the specified properties.
             * @param [properties] Properties to set
             * @returns StringList instance
             */
            static create(properties: anki.generic.StringList.$Shape): anki.generic.StringList & anki.generic.StringList.$Shape;
            static create(properties?: anki.generic.StringList.$Properties): anki.generic.StringList;

            /**
             * Encodes the specified StringList message. Does not implicitly {@link anki.generic.StringList.verify|verify} messages.
             * @param message StringList message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.generic.StringList.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a StringList message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.generic.StringList & anki.generic.StringList.$Shape} StringList
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.generic.StringList & anki.generic.StringList.$Shape;
        }

        namespace StringList {

            /** Properties of a StringList. */
            interface $Properties {

                /** StringList vals */
                vals?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a StringList. */
            type $Shape = anki.generic.StringList.$Properties;
        }
    }

    /** Namespace cards. */
    namespace cards {

        /**
         * Properties of a CardId.
         * @deprecated Use anki.cards.CardId.$Properties instead.
         */
        interface ICardId extends anki.cards.CardId.$Properties {
        }

        /** Represents a CardId. */
        class CardId {

            /**
             * Constructs a new CardId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.CardId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CardId cid. */
            cid: (number|Long);

            /**
             * Creates a new CardId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CardId instance
             */
            static create(properties: anki.cards.CardId.$Shape): anki.cards.CardId & anki.cards.CardId.$Shape;
            static create(properties?: anki.cards.CardId.$Properties): anki.cards.CardId;

            /**
             * Encodes the specified CardId message. Does not implicitly {@link anki.cards.CardId.verify|verify} messages.
             * @param message CardId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.CardId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CardId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.CardId & anki.cards.CardId.$Shape} CardId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.CardId & anki.cards.CardId.$Shape;
        }

        namespace CardId {

            /** Properties of a CardId. */
            interface $Properties {

                /** CardId cid */
                cid?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CardId. */
            type $Shape = anki.cards.CardId.$Properties;
        }

        /**
         * Properties of a CardIds.
         * @deprecated Use anki.cards.CardIds.$Properties instead.
         */
        interface ICardIds extends anki.cards.CardIds.$Properties {
        }

        /** Represents a CardIds. */
        class CardIds {

            /**
             * Constructs a new CardIds.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.CardIds.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CardIds cids. */
            cids: (number|Long)[];

            /**
             * Creates a new CardIds instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CardIds instance
             */
            static create(properties: anki.cards.CardIds.$Shape): anki.cards.CardIds & anki.cards.CardIds.$Shape;
            static create(properties?: anki.cards.CardIds.$Properties): anki.cards.CardIds;

            /**
             * Encodes the specified CardIds message. Does not implicitly {@link anki.cards.CardIds.verify|verify} messages.
             * @param message CardIds message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.CardIds.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CardIds message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.CardIds & anki.cards.CardIds.$Shape} CardIds
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.CardIds & anki.cards.CardIds.$Shape;
        }

        namespace CardIds {

            /** Properties of a CardIds. */
            interface $Properties {

                /** CardIds cids */
                cids?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CardIds. */
            type $Shape = anki.cards.CardIds.$Properties;
        }

        /**
         * Properties of a Card.
         * @deprecated Use anki.cards.Card.$Properties instead.
         */
        interface ICard extends anki.cards.Card.$Properties {
        }

        /** Represents a Card. */
        class Card {

            /**
             * Constructs a new Card.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.Card.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Card id. */
            id: (number|Long);

            /** Card noteId. */
            noteId: (number|Long);

            /** Card deckId. */
            deckId: (number|Long);

            /** Card templateIdx. */
            templateIdx: number;

            /** Card mtimeSecs. */
            mtimeSecs: (number|Long);

            /** Card usn. */
            usn: number;

            /** Card ctype. */
            ctype: number;

            /** Card queue. */
            queue: number;

            /** Card due. */
            due: number;

            /** Card interval. */
            interval: number;

            /** Card easeFactor. */
            easeFactor: number;

            /** Card reps. */
            reps: number;

            /** Card lapses. */
            lapses: number;

            /** Card remainingSteps. */
            remainingSteps: number;

            /** Card originalDue. */
            originalDue: number;

            /** Card originalDeckId. */
            originalDeckId: (number|Long);

            /** Card flags. */
            flags: number;

            /** Card originalPosition. */
            originalPosition?: (number|null);

            /** Card memoryState. */
            memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

            /** Card desiredRetention. */
            desiredRetention?: (number|null);

            /** Card decay. */
            decay?: (number|null);

            /** Card lastReviewTimeSecs. */
            lastReviewTimeSecs?: (number|Long|null);

            /** Card customData. */
            customData: string;

            /**
             * Creates a new Card instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Card instance
             */
            static create(properties: anki.cards.Card.$Shape): anki.cards.Card & anki.cards.Card.$Shape;
            static create(properties?: anki.cards.Card.$Properties): anki.cards.Card;

            /**
             * Encodes the specified Card message. Does not implicitly {@link anki.cards.Card.verify|verify} messages.
             * @param message Card message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.Card.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Card message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.Card & anki.cards.Card.$Shape} Card
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.Card & anki.cards.Card.$Shape;
        }

        namespace Card {

            /** Properties of a Card. */
            interface $Properties {

                /** Card id */
                id?: (number|Long|null);

                /** Card noteId */
                noteId?: (number|Long|null);

                /** Card deckId */
                deckId?: (number|Long|null);

                /** Card templateIdx */
                templateIdx?: (number|null);

                /** Card mtimeSecs */
                mtimeSecs?: (number|Long|null);

                /** Card usn */
                usn?: (number|null);

                /** Card ctype */
                ctype?: (number|null);

                /** Card queue */
                queue?: (number|null);

                /** Card due */
                due?: (number|null);

                /** Card interval */
                interval?: (number|null);

                /** Card easeFactor */
                easeFactor?: (number|null);

                /** Card reps */
                reps?: (number|null);

                /** Card lapses */
                lapses?: (number|null);

                /** Card remainingSteps */
                remainingSteps?: (number|null);

                /** Card originalDue */
                originalDue?: (number|null);

                /** Card originalDeckId */
                originalDeckId?: (number|Long|null);

                /** Card flags */
                flags?: (number|null);

                /** Card originalPosition */
                originalPosition?: (number|null);

                /** Card memoryState */
                memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                /** Card desiredRetention */
                desiredRetention?: (number|null);

                /** Card decay */
                decay?: (number|null);

                /** Card lastReviewTimeSecs */
                lastReviewTimeSecs?: (number|Long|null);

                /** Card customData */
                customData?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Card. */
            type $Shape = anki.cards.Card.$Properties;
        }

        /**
         * Properties of a FsrsMemoryState.
         * @deprecated Use anki.cards.FsrsMemoryState.$Properties instead.
         */
        interface IFsrsMemoryState extends anki.cards.FsrsMemoryState.$Properties {
        }

        /** Represents a FsrsMemoryState. */
        class FsrsMemoryState {

            /**
             * Constructs a new FsrsMemoryState.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.FsrsMemoryState.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FsrsMemoryState stability. */
            stability: number;

            /** FsrsMemoryState difficulty. */
            difficulty: number;

            /**
             * Creates a new FsrsMemoryState instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FsrsMemoryState instance
             */
            static create(properties: anki.cards.FsrsMemoryState.$Shape): anki.cards.FsrsMemoryState & anki.cards.FsrsMemoryState.$Shape;
            static create(properties?: anki.cards.FsrsMemoryState.$Properties): anki.cards.FsrsMemoryState;

            /**
             * Encodes the specified FsrsMemoryState message. Does not implicitly {@link anki.cards.FsrsMemoryState.verify|verify} messages.
             * @param message FsrsMemoryState message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.FsrsMemoryState.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FsrsMemoryState message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.FsrsMemoryState & anki.cards.FsrsMemoryState.$Shape} FsrsMemoryState
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.FsrsMemoryState & anki.cards.FsrsMemoryState.$Shape;
        }

        namespace FsrsMemoryState {

            /** Properties of a FsrsMemoryState. */
            interface $Properties {

                /** FsrsMemoryState stability */
                stability?: (number|null);

                /** FsrsMemoryState difficulty */
                difficulty?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FsrsMemoryState. */
            type $Shape = anki.cards.FsrsMemoryState.$Properties;
        }

        /**
         * Properties of an UpdateCardsRequest.
         * @deprecated Use anki.cards.UpdateCardsRequest.$Properties instead.
         */
        interface IUpdateCardsRequest extends anki.cards.UpdateCardsRequest.$Properties {
        }

        /** Represents an UpdateCardsRequest. */
        class UpdateCardsRequest {

            /**
             * Constructs a new UpdateCardsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.UpdateCardsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UpdateCardsRequest cards. */
            cards: anki.cards.Card.$Properties[];

            /** UpdateCardsRequest skipUndoEntry. */
            skipUndoEntry: boolean;

            /**
             * Creates a new UpdateCardsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UpdateCardsRequest instance
             */
            static create(properties: anki.cards.UpdateCardsRequest.$Shape): anki.cards.UpdateCardsRequest & anki.cards.UpdateCardsRequest.$Shape;
            static create(properties?: anki.cards.UpdateCardsRequest.$Properties): anki.cards.UpdateCardsRequest;

            /**
             * Encodes the specified UpdateCardsRequest message. Does not implicitly {@link anki.cards.UpdateCardsRequest.verify|verify} messages.
             * @param message UpdateCardsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.UpdateCardsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UpdateCardsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.UpdateCardsRequest & anki.cards.UpdateCardsRequest.$Shape} UpdateCardsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.UpdateCardsRequest & anki.cards.UpdateCardsRequest.$Shape;
        }

        namespace UpdateCardsRequest {

            /** Properties of an UpdateCardsRequest. */
            interface $Properties {

                /** UpdateCardsRequest cards */
                cards?: (anki.cards.Card.$Properties[]|null);

                /** UpdateCardsRequest skipUndoEntry */
                skipUndoEntry?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an UpdateCardsRequest. */
            type $Shape = anki.cards.UpdateCardsRequest.$Properties;
        }

        /**
         * Properties of a RemoveCardsRequest.
         * @deprecated Use anki.cards.RemoveCardsRequest.$Properties instead.
         */
        interface IRemoveCardsRequest extends anki.cards.RemoveCardsRequest.$Properties {
        }

        /** Represents a RemoveCardsRequest. */
        class RemoveCardsRequest {

            /**
             * Constructs a new RemoveCardsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.RemoveCardsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RemoveCardsRequest cardIds. */
            cardIds: (number|Long)[];

            /**
             * Creates a new RemoveCardsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RemoveCardsRequest instance
             */
            static create(properties: anki.cards.RemoveCardsRequest.$Shape): anki.cards.RemoveCardsRequest & anki.cards.RemoveCardsRequest.$Shape;
            static create(properties?: anki.cards.RemoveCardsRequest.$Properties): anki.cards.RemoveCardsRequest;

            /**
             * Encodes the specified RemoveCardsRequest message. Does not implicitly {@link anki.cards.RemoveCardsRequest.verify|verify} messages.
             * @param message RemoveCardsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.RemoveCardsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RemoveCardsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.RemoveCardsRequest & anki.cards.RemoveCardsRequest.$Shape} RemoveCardsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.RemoveCardsRequest & anki.cards.RemoveCardsRequest.$Shape;
        }

        namespace RemoveCardsRequest {

            /** Properties of a RemoveCardsRequest. */
            interface $Properties {

                /** RemoveCardsRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RemoveCardsRequest. */
            type $Shape = anki.cards.RemoveCardsRequest.$Properties;
        }

        /**
         * Properties of a SetDeckRequest.
         * @deprecated Use anki.cards.SetDeckRequest.$Properties instead.
         */
        interface ISetDeckRequest extends anki.cards.SetDeckRequest.$Properties {
        }

        /** Represents a SetDeckRequest. */
        class SetDeckRequest {

            /**
             * Constructs a new SetDeckRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.SetDeckRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetDeckRequest cardIds. */
            cardIds: (number|Long)[];

            /** SetDeckRequest deckId. */
            deckId: (number|Long);

            /**
             * Creates a new SetDeckRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetDeckRequest instance
             */
            static create(properties: anki.cards.SetDeckRequest.$Shape): anki.cards.SetDeckRequest & anki.cards.SetDeckRequest.$Shape;
            static create(properties?: anki.cards.SetDeckRequest.$Properties): anki.cards.SetDeckRequest;

            /**
             * Encodes the specified SetDeckRequest message. Does not implicitly {@link anki.cards.SetDeckRequest.verify|verify} messages.
             * @param message SetDeckRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.SetDeckRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetDeckRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.SetDeckRequest & anki.cards.SetDeckRequest.$Shape} SetDeckRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.SetDeckRequest & anki.cards.SetDeckRequest.$Shape;
        }

        namespace SetDeckRequest {

            /** Properties of a SetDeckRequest. */
            interface $Properties {

                /** SetDeckRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** SetDeckRequest deckId */
                deckId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetDeckRequest. */
            type $Shape = anki.cards.SetDeckRequest.$Properties;
        }

        /**
         * Properties of a SetFlagRequest.
         * @deprecated Use anki.cards.SetFlagRequest.$Properties instead.
         */
        interface ISetFlagRequest extends anki.cards.SetFlagRequest.$Properties {
        }

        /** Represents a SetFlagRequest. */
        class SetFlagRequest {

            /**
             * Constructs a new SetFlagRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.cards.SetFlagRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetFlagRequest cardIds. */
            cardIds: (number|Long)[];

            /** SetFlagRequest flag. */
            flag: number;

            /**
             * Creates a new SetFlagRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetFlagRequest instance
             */
            static create(properties: anki.cards.SetFlagRequest.$Shape): anki.cards.SetFlagRequest & anki.cards.SetFlagRequest.$Shape;
            static create(properties?: anki.cards.SetFlagRequest.$Properties): anki.cards.SetFlagRequest;

            /**
             * Encodes the specified SetFlagRequest message. Does not implicitly {@link anki.cards.SetFlagRequest.verify|verify} messages.
             * @param message SetFlagRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.cards.SetFlagRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetFlagRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.cards.SetFlagRequest & anki.cards.SetFlagRequest.$Shape} SetFlagRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.cards.SetFlagRequest & anki.cards.SetFlagRequest.$Shape;
        }

        namespace SetFlagRequest {

            /** Properties of a SetFlagRequest. */
            interface $Properties {

                /** SetFlagRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** SetFlagRequest flag */
                flag?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetFlagRequest. */
            type $Shape = anki.cards.SetFlagRequest.$Properties;
        }
    }

    /** Namespace config. */
    namespace config {

        /**
         * Properties of a ConfigKey.
         * @deprecated Use anki.config.ConfigKey.$Properties instead.
         */
        interface IConfigKey extends anki.config.ConfigKey.$Properties {
        }

        /** Represents a ConfigKey. */
        class ConfigKey {

            /**
             * Constructs a new ConfigKey.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.ConfigKey.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /**
             * Creates a new ConfigKey instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ConfigKey instance
             */
            static create(properties: anki.config.ConfigKey.$Shape): anki.config.ConfigKey & anki.config.ConfigKey.$Shape;
            static create(properties?: anki.config.ConfigKey.$Properties): anki.config.ConfigKey;

            /**
             * Encodes the specified ConfigKey message. Does not implicitly {@link anki.config.ConfigKey.verify|verify} messages.
             * @param message ConfigKey message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.ConfigKey.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ConfigKey message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.ConfigKey & anki.config.ConfigKey.$Shape} ConfigKey
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.ConfigKey & anki.config.ConfigKey.$Shape;
        }

        namespace ConfigKey {

            /** Properties of a ConfigKey. */
            interface $Properties {

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ConfigKey. */
            type $Shape = anki.config.ConfigKey.$Properties;

            /** Bool enum. */
            enum Bool {

                /** BROWSER_TABLE_SHOW_NOTES_MODE value */
                BROWSER_TABLE_SHOW_NOTES_MODE = 0,

                /** PREVIEW_BOTH_SIDES value */
                PREVIEW_BOTH_SIDES = 3,

                /** COLLAPSE_TAGS value */
                COLLAPSE_TAGS = 4,

                /** COLLAPSE_NOTETYPES value */
                COLLAPSE_NOTETYPES = 5,

                /** COLLAPSE_DECKS value */
                COLLAPSE_DECKS = 6,

                /** COLLAPSE_SAVED_SEARCHES value */
                COLLAPSE_SAVED_SEARCHES = 7,

                /** COLLAPSE_TODAY value */
                COLLAPSE_TODAY = 8,

                /** COLLAPSE_CARD_STATE value */
                COLLAPSE_CARD_STATE = 9,

                /** COLLAPSE_FLAGS value */
                COLLAPSE_FLAGS = 10,

                /** SCHED_2021 value */
                SCHED_2021 = 11,

                /** ADDING_DEFAULTS_TO_CURRENT_DECK value */
                ADDING_DEFAULTS_TO_CURRENT_DECK = 12,

                /** HIDE_AUDIO_PLAY_BUTTONS value */
                HIDE_AUDIO_PLAY_BUTTONS = 13,

                /** INTERRUPT_AUDIO_WHEN_ANSWERING value */
                INTERRUPT_AUDIO_WHEN_ANSWERING = 14,

                /** PASTE_IMAGES_AS_PNG value */
                PASTE_IMAGES_AS_PNG = 15,

                /** PASTE_STRIPS_FORMATTING value */
                PASTE_STRIPS_FORMATTING = 16,

                /** NORMALIZE_NOTE_TEXT value */
                NORMALIZE_NOTE_TEXT = 17,

                /** IGNORE_ACCENTS_IN_SEARCH value */
                IGNORE_ACCENTS_IN_SEARCH = 18,

                /** RESTORE_POSITION_BROWSER value */
                RESTORE_POSITION_BROWSER = 19,

                /** RESTORE_POSITION_REVIEWER value */
                RESTORE_POSITION_REVIEWER = 20,

                /** RESET_COUNTS_BROWSER value */
                RESET_COUNTS_BROWSER = 21,

                /** RESET_COUNTS_REVIEWER value */
                RESET_COUNTS_REVIEWER = 22,

                /** RANDOM_ORDER_REPOSITION value */
                RANDOM_ORDER_REPOSITION = 23,

                /** SHIFT_POSITION_OF_EXISTING_CARDS value */
                SHIFT_POSITION_OF_EXISTING_CARDS = 24,

                /** RENDER_LATEX value */
                RENDER_LATEX = 25,

                /** LOAD_BALANCER_ENABLED value */
                LOAD_BALANCER_ENABLED = 26,

                /** FSRS_SHORT_TERM_WITH_STEPS_ENABLED value */
                FSRS_SHORT_TERM_WITH_STEPS_ENABLED = 27,

                /** FSRS_LEGACY_EVALUATE value */
                FSRS_LEGACY_EVALUATE = 28
            }

            /** String enum. */
            enum String {

                /** SET_DUE_BROWSER value */
                SET_DUE_BROWSER = 0,

                /** SET_DUE_REVIEWER value */
                SET_DUE_REVIEWER = 1,

                /** DEFAULT_SEARCH_TEXT value */
                DEFAULT_SEARCH_TEXT = 2,

                /** CARD_STATE_CUSTOMIZER value */
                CARD_STATE_CUSTOMIZER = 3
            }
        }

        /**
         * Properties of a GetConfigBoolRequest.
         * @deprecated Use anki.config.GetConfigBoolRequest.$Properties instead.
         */
        interface IGetConfigBoolRequest extends anki.config.GetConfigBoolRequest.$Properties {
        }

        /** Represents a GetConfigBoolRequest. */
        class GetConfigBoolRequest {

            /**
             * Constructs a new GetConfigBoolRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.GetConfigBoolRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GetConfigBoolRequest key. */
            key: anki.config.ConfigKey.Bool;

            /**
             * Creates a new GetConfigBoolRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetConfigBoolRequest instance
             */
            static create(properties: anki.config.GetConfigBoolRequest.$Shape): anki.config.GetConfigBoolRequest & anki.config.GetConfigBoolRequest.$Shape;
            static create(properties?: anki.config.GetConfigBoolRequest.$Properties): anki.config.GetConfigBoolRequest;

            /**
             * Encodes the specified GetConfigBoolRequest message. Does not implicitly {@link anki.config.GetConfigBoolRequest.verify|verify} messages.
             * @param message GetConfigBoolRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.GetConfigBoolRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetConfigBoolRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.GetConfigBoolRequest & anki.config.GetConfigBoolRequest.$Shape} GetConfigBoolRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.GetConfigBoolRequest & anki.config.GetConfigBoolRequest.$Shape;
        }

        namespace GetConfigBoolRequest {

            /** Properties of a GetConfigBoolRequest. */
            interface $Properties {

                /** GetConfigBoolRequest key */
                key?: (anki.config.ConfigKey.Bool|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GetConfigBoolRequest. */
            type $Shape = anki.config.GetConfigBoolRequest.$Properties;
        }

        /**
         * Properties of a SetConfigBoolRequest.
         * @deprecated Use anki.config.SetConfigBoolRequest.$Properties instead.
         */
        interface ISetConfigBoolRequest extends anki.config.SetConfigBoolRequest.$Properties {
        }

        /** Represents a SetConfigBoolRequest. */
        class SetConfigBoolRequest {

            /**
             * Constructs a new SetConfigBoolRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.SetConfigBoolRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetConfigBoolRequest key. */
            key: anki.config.ConfigKey.Bool;

            /** SetConfigBoolRequest value. */
            value: boolean;

            /** SetConfigBoolRequest undoable. */
            undoable: boolean;

            /**
             * Creates a new SetConfigBoolRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetConfigBoolRequest instance
             */
            static create(properties: anki.config.SetConfigBoolRequest.$Shape): anki.config.SetConfigBoolRequest & anki.config.SetConfigBoolRequest.$Shape;
            static create(properties?: anki.config.SetConfigBoolRequest.$Properties): anki.config.SetConfigBoolRequest;

            /**
             * Encodes the specified SetConfigBoolRequest message. Does not implicitly {@link anki.config.SetConfigBoolRequest.verify|verify} messages.
             * @param message SetConfigBoolRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.SetConfigBoolRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetConfigBoolRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.SetConfigBoolRequest & anki.config.SetConfigBoolRequest.$Shape} SetConfigBoolRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.SetConfigBoolRequest & anki.config.SetConfigBoolRequest.$Shape;
        }

        namespace SetConfigBoolRequest {

            /** Properties of a SetConfigBoolRequest. */
            interface $Properties {

                /** SetConfigBoolRequest key */
                key?: (anki.config.ConfigKey.Bool|null);

                /** SetConfigBoolRequest value */
                value?: (boolean|null);

                /** SetConfigBoolRequest undoable */
                undoable?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetConfigBoolRequest. */
            type $Shape = anki.config.SetConfigBoolRequest.$Properties;
        }

        /**
         * Properties of a GetConfigStringRequest.
         * @deprecated Use anki.config.GetConfigStringRequest.$Properties instead.
         */
        interface IGetConfigStringRequest extends anki.config.GetConfigStringRequest.$Properties {
        }

        /** Represents a GetConfigStringRequest. */
        class GetConfigStringRequest {

            /**
             * Constructs a new GetConfigStringRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.GetConfigStringRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GetConfigStringRequest key. */
            key: anki.config.ConfigKey.String;

            /**
             * Creates a new GetConfigStringRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetConfigStringRequest instance
             */
            static create(properties: anki.config.GetConfigStringRequest.$Shape): anki.config.GetConfigStringRequest & anki.config.GetConfigStringRequest.$Shape;
            static create(properties?: anki.config.GetConfigStringRequest.$Properties): anki.config.GetConfigStringRequest;

            /**
             * Encodes the specified GetConfigStringRequest message. Does not implicitly {@link anki.config.GetConfigStringRequest.verify|verify} messages.
             * @param message GetConfigStringRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.GetConfigStringRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetConfigStringRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.GetConfigStringRequest & anki.config.GetConfigStringRequest.$Shape} GetConfigStringRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.GetConfigStringRequest & anki.config.GetConfigStringRequest.$Shape;
        }

        namespace GetConfigStringRequest {

            /** Properties of a GetConfigStringRequest. */
            interface $Properties {

                /** GetConfigStringRequest key */
                key?: (anki.config.ConfigKey.String|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GetConfigStringRequest. */
            type $Shape = anki.config.GetConfigStringRequest.$Properties;
        }

        /**
         * Properties of a SetConfigStringRequest.
         * @deprecated Use anki.config.SetConfigStringRequest.$Properties instead.
         */
        interface ISetConfigStringRequest extends anki.config.SetConfigStringRequest.$Properties {
        }

        /** Represents a SetConfigStringRequest. */
        class SetConfigStringRequest {

            /**
             * Constructs a new SetConfigStringRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.SetConfigStringRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetConfigStringRequest key. */
            key: anki.config.ConfigKey.String;

            /** SetConfigStringRequest value. */
            value: string;

            /** SetConfigStringRequest undoable. */
            undoable: boolean;

            /**
             * Creates a new SetConfigStringRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetConfigStringRequest instance
             */
            static create(properties: anki.config.SetConfigStringRequest.$Shape): anki.config.SetConfigStringRequest & anki.config.SetConfigStringRequest.$Shape;
            static create(properties?: anki.config.SetConfigStringRequest.$Properties): anki.config.SetConfigStringRequest;

            /**
             * Encodes the specified SetConfigStringRequest message. Does not implicitly {@link anki.config.SetConfigStringRequest.verify|verify} messages.
             * @param message SetConfigStringRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.SetConfigStringRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetConfigStringRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.SetConfigStringRequest & anki.config.SetConfigStringRequest.$Shape} SetConfigStringRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.SetConfigStringRequest & anki.config.SetConfigStringRequest.$Shape;
        }

        namespace SetConfigStringRequest {

            /** Properties of a SetConfigStringRequest. */
            interface $Properties {

                /** SetConfigStringRequest key */
                key?: (anki.config.ConfigKey.String|null);

                /** SetConfigStringRequest value */
                value?: (string|null);

                /** SetConfigStringRequest undoable */
                undoable?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetConfigStringRequest. */
            type $Shape = anki.config.SetConfigStringRequest.$Properties;
        }

        /**
         * Properties of an OptionalStringConfigKey.
         * @deprecated Use anki.config.OptionalStringConfigKey.$Properties instead.
         */
        interface IOptionalStringConfigKey extends anki.config.OptionalStringConfigKey.$Properties {
        }

        /** Represents an OptionalStringConfigKey. */
        class OptionalStringConfigKey {

            /**
             * Constructs a new OptionalStringConfigKey.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.OptionalStringConfigKey.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** OptionalStringConfigKey key. */
            key: anki.config.ConfigKey.String;

            /**
             * Creates a new OptionalStringConfigKey instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OptionalStringConfigKey instance
             */
            static create(properties: anki.config.OptionalStringConfigKey.$Shape): anki.config.OptionalStringConfigKey & anki.config.OptionalStringConfigKey.$Shape;
            static create(properties?: anki.config.OptionalStringConfigKey.$Properties): anki.config.OptionalStringConfigKey;

            /**
             * Encodes the specified OptionalStringConfigKey message. Does not implicitly {@link anki.config.OptionalStringConfigKey.verify|verify} messages.
             * @param message OptionalStringConfigKey message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.OptionalStringConfigKey.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OptionalStringConfigKey message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.OptionalStringConfigKey & anki.config.OptionalStringConfigKey.$Shape} OptionalStringConfigKey
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.OptionalStringConfigKey & anki.config.OptionalStringConfigKey.$Shape;
        }

        namespace OptionalStringConfigKey {

            /** Properties of an OptionalStringConfigKey. */
            interface $Properties {

                /** OptionalStringConfigKey key */
                key?: (anki.config.ConfigKey.String|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an OptionalStringConfigKey. */
            type $Shape = anki.config.OptionalStringConfigKey.$Properties;
        }

        /**
         * Properties of a SetConfigJsonRequest.
         * @deprecated Use anki.config.SetConfigJsonRequest.$Properties instead.
         */
        interface ISetConfigJsonRequest extends anki.config.SetConfigJsonRequest.$Properties {
        }

        /** Represents a SetConfigJsonRequest. */
        class SetConfigJsonRequest {

            /**
             * Constructs a new SetConfigJsonRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.SetConfigJsonRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetConfigJsonRequest key. */
            key: string;

            /** SetConfigJsonRequest valueJson. */
            valueJson: Uint8Array;

            /** SetConfigJsonRequest undoable. */
            undoable: boolean;

            /**
             * Creates a new SetConfigJsonRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetConfigJsonRequest instance
             */
            static create(properties: anki.config.SetConfigJsonRequest.$Shape): anki.config.SetConfigJsonRequest & anki.config.SetConfigJsonRequest.$Shape;
            static create(properties?: anki.config.SetConfigJsonRequest.$Properties): anki.config.SetConfigJsonRequest;

            /**
             * Encodes the specified SetConfigJsonRequest message. Does not implicitly {@link anki.config.SetConfigJsonRequest.verify|verify} messages.
             * @param message SetConfigJsonRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.SetConfigJsonRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetConfigJsonRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.SetConfigJsonRequest & anki.config.SetConfigJsonRequest.$Shape} SetConfigJsonRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.SetConfigJsonRequest & anki.config.SetConfigJsonRequest.$Shape;
        }

        namespace SetConfigJsonRequest {

            /** Properties of a SetConfigJsonRequest. */
            interface $Properties {

                /** SetConfigJsonRequest key */
                key?: (string|null);

                /** SetConfigJsonRequest valueJson */
                valueJson?: (Uint8Array|null);

                /** SetConfigJsonRequest undoable */
                undoable?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetConfigJsonRequest. */
            type $Shape = anki.config.SetConfigJsonRequest.$Properties;
        }

        /**
         * Properties of a Preferences.
         * @deprecated Use anki.config.Preferences.$Properties instead.
         */
        interface IPreferences extends anki.config.Preferences.$Properties {
        }

        /** Represents a Preferences. */
        class Preferences {

            /**
             * Constructs a new Preferences.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.config.Preferences.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Preferences scheduling. */
            scheduling?: (anki.config.Preferences.Scheduling.$Properties|null);

            /** Preferences reviewing. */
            reviewing?: (anki.config.Preferences.Reviewing.$Properties|null);

            /** Preferences editing. */
            editing?: (anki.config.Preferences.Editing.$Properties|null);

            /** Preferences backups. */
            backups?: (anki.config.Preferences.BackupLimits.$Properties|null);

            /**
             * Creates a new Preferences instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Preferences instance
             */
            static create(properties: anki.config.Preferences.$Shape): anki.config.Preferences & anki.config.Preferences.$Shape;
            static create(properties?: anki.config.Preferences.$Properties): anki.config.Preferences;

            /**
             * Encodes the specified Preferences message. Does not implicitly {@link anki.config.Preferences.verify|verify} messages.
             * @param message Preferences message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.config.Preferences.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Preferences message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.config.Preferences & anki.config.Preferences.$Shape} Preferences
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.Preferences & anki.config.Preferences.$Shape;
        }

        namespace Preferences {

            /** Properties of a Preferences. */
            interface $Properties {

                /** Preferences scheduling */
                scheduling?: (anki.config.Preferences.Scheduling.$Properties|null);

                /** Preferences reviewing */
                reviewing?: (anki.config.Preferences.Reviewing.$Properties|null);

                /** Preferences editing */
                editing?: (anki.config.Preferences.Editing.$Properties|null);

                /** Preferences backups */
                backups?: (anki.config.Preferences.BackupLimits.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a Preferences. */
            type $Shape = anki.config.Preferences.$Properties;

            /**
             * Properties of a Scheduling.
             * @deprecated Use anki.config.Preferences.Scheduling.$Properties instead.
             */
            interface IScheduling extends anki.config.Preferences.Scheduling.$Properties {
            }

            /** Represents a Scheduling. */
            class Scheduling {

                /**
                 * Constructs a new Scheduling.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.config.Preferences.Scheduling.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Scheduling rollover. */
                rollover: number;

                /** Scheduling learnAheadSecs. */
                learnAheadSecs: number;

                /** Scheduling newReviewMix. */
                newReviewMix: anki.config.Preferences.Scheduling.NewReviewMix;

                /** Scheduling newTimezone. */
                newTimezone: boolean;

                /** Scheduling dayLearnFirst. */
                dayLearnFirst: boolean;

                /**
                 * Creates a new Scheduling instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Scheduling instance
                 */
                static create(properties: anki.config.Preferences.Scheduling.$Shape): anki.config.Preferences.Scheduling & anki.config.Preferences.Scheduling.$Shape;
                static create(properties?: anki.config.Preferences.Scheduling.$Properties): anki.config.Preferences.Scheduling;

                /**
                 * Encodes the specified Scheduling message. Does not implicitly {@link anki.config.Preferences.Scheduling.verify|verify} messages.
                 * @param message Scheduling message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.config.Preferences.Scheduling.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Scheduling message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.config.Preferences.Scheduling & anki.config.Preferences.Scheduling.$Shape} Scheduling
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.Preferences.Scheduling & anki.config.Preferences.Scheduling.$Shape;
            }

            namespace Scheduling {

                /** Properties of a Scheduling. */
                interface $Properties {

                    /** Scheduling rollover */
                    rollover?: (number|null);

                    /** Scheduling learnAheadSecs */
                    learnAheadSecs?: (number|null);

                    /** Scheduling newReviewMix */
                    newReviewMix?: (anki.config.Preferences.Scheduling.NewReviewMix|null);

                    /** Scheduling newTimezone */
                    newTimezone?: (boolean|null);

                    /** Scheduling dayLearnFirst */
                    dayLearnFirst?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Scheduling. */
                type $Shape = anki.config.Preferences.Scheduling.$Properties;

                /** NewReviewMix enum. */
                enum NewReviewMix {

                    /** DISTRIBUTE value */
                    DISTRIBUTE = 0,

                    /** REVIEWS_FIRST value */
                    REVIEWS_FIRST = 1,

                    /** NEW_FIRST value */
                    NEW_FIRST = 2
                }
            }

            /**
             * Properties of a Reviewing.
             * @deprecated Use anki.config.Preferences.Reviewing.$Properties instead.
             */
            interface IReviewing extends anki.config.Preferences.Reviewing.$Properties {
            }

            /** Represents a Reviewing. */
            class Reviewing {

                /**
                 * Constructs a new Reviewing.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.config.Preferences.Reviewing.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Reviewing hideAudioPlayButtons. */
                hideAudioPlayButtons: boolean;

                /** Reviewing interruptAudioWhenAnswering. */
                interruptAudioWhenAnswering: boolean;

                /** Reviewing showRemainingDueCounts. */
                showRemainingDueCounts: boolean;

                /** Reviewing showIntervalsOnButtons. */
                showIntervalsOnButtons: boolean;

                /** Reviewing timeLimitSecs. */
                timeLimitSecs: number;

                /** Reviewing loadBalancerEnabled. */
                loadBalancerEnabled: boolean;

                /** Reviewing fsrsShortTermWithStepsEnabled. */
                fsrsShortTermWithStepsEnabled: boolean;

                /**
                 * Creates a new Reviewing instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Reviewing instance
                 */
                static create(properties: anki.config.Preferences.Reviewing.$Shape): anki.config.Preferences.Reviewing & anki.config.Preferences.Reviewing.$Shape;
                static create(properties?: anki.config.Preferences.Reviewing.$Properties): anki.config.Preferences.Reviewing;

                /**
                 * Encodes the specified Reviewing message. Does not implicitly {@link anki.config.Preferences.Reviewing.verify|verify} messages.
                 * @param message Reviewing message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.config.Preferences.Reviewing.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Reviewing message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.config.Preferences.Reviewing & anki.config.Preferences.Reviewing.$Shape} Reviewing
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.Preferences.Reviewing & anki.config.Preferences.Reviewing.$Shape;
            }

            namespace Reviewing {

                /** Properties of a Reviewing. */
                interface $Properties {

                    /** Reviewing hideAudioPlayButtons */
                    hideAudioPlayButtons?: (boolean|null);

                    /** Reviewing interruptAudioWhenAnswering */
                    interruptAudioWhenAnswering?: (boolean|null);

                    /** Reviewing showRemainingDueCounts */
                    showRemainingDueCounts?: (boolean|null);

                    /** Reviewing showIntervalsOnButtons */
                    showIntervalsOnButtons?: (boolean|null);

                    /** Reviewing timeLimitSecs */
                    timeLimitSecs?: (number|null);

                    /** Reviewing loadBalancerEnabled */
                    loadBalancerEnabled?: (boolean|null);

                    /** Reviewing fsrsShortTermWithStepsEnabled */
                    fsrsShortTermWithStepsEnabled?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Reviewing. */
                type $Shape = anki.config.Preferences.Reviewing.$Properties;
            }

            /**
             * Properties of an Editing.
             * @deprecated Use anki.config.Preferences.Editing.$Properties instead.
             */
            interface IEditing extends anki.config.Preferences.Editing.$Properties {
            }

            /** Represents an Editing. */
            class Editing {

                /**
                 * Constructs a new Editing.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.config.Preferences.Editing.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Editing addingDefaultsToCurrentDeck. */
                addingDefaultsToCurrentDeck: boolean;

                /** Editing pasteImagesAsPng. */
                pasteImagesAsPng: boolean;

                /** Editing pasteStripsFormatting. */
                pasteStripsFormatting: boolean;

                /** Editing defaultSearchText. */
                defaultSearchText: string;

                /** Editing ignoreAccentsInSearch. */
                ignoreAccentsInSearch: boolean;

                /** Editing renderLatex. */
                renderLatex: boolean;

                /**
                 * Creates a new Editing instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Editing instance
                 */
                static create(properties: anki.config.Preferences.Editing.$Shape): anki.config.Preferences.Editing & anki.config.Preferences.Editing.$Shape;
                static create(properties?: anki.config.Preferences.Editing.$Properties): anki.config.Preferences.Editing;

                /**
                 * Encodes the specified Editing message. Does not implicitly {@link anki.config.Preferences.Editing.verify|verify} messages.
                 * @param message Editing message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.config.Preferences.Editing.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Editing message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.config.Preferences.Editing & anki.config.Preferences.Editing.$Shape} Editing
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.Preferences.Editing & anki.config.Preferences.Editing.$Shape;
            }

            namespace Editing {

                /** Properties of an Editing. */
                interface $Properties {

                    /** Editing addingDefaultsToCurrentDeck */
                    addingDefaultsToCurrentDeck?: (boolean|null);

                    /** Editing pasteImagesAsPng */
                    pasteImagesAsPng?: (boolean|null);

                    /** Editing pasteStripsFormatting */
                    pasteStripsFormatting?: (boolean|null);

                    /** Editing defaultSearchText */
                    defaultSearchText?: (string|null);

                    /** Editing ignoreAccentsInSearch */
                    ignoreAccentsInSearch?: (boolean|null);

                    /** Editing renderLatex */
                    renderLatex?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an Editing. */
                type $Shape = anki.config.Preferences.Editing.$Properties;
            }

            /**
             * Properties of a BackupLimits.
             * @deprecated Use anki.config.Preferences.BackupLimits.$Properties instead.
             */
            interface IBackupLimits extends anki.config.Preferences.BackupLimits.$Properties {
            }

            /** Represents a BackupLimits. */
            class BackupLimits {

                /**
                 * Constructs a new BackupLimits.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.config.Preferences.BackupLimits.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** BackupLimits daily. */
                daily: number;

                /** BackupLimits weekly. */
                weekly: number;

                /** BackupLimits monthly. */
                monthly: number;

                /** BackupLimits minimumIntervalMins. */
                minimumIntervalMins: number;

                /**
                 * Creates a new BackupLimits instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns BackupLimits instance
                 */
                static create(properties: anki.config.Preferences.BackupLimits.$Shape): anki.config.Preferences.BackupLimits & anki.config.Preferences.BackupLimits.$Shape;
                static create(properties?: anki.config.Preferences.BackupLimits.$Properties): anki.config.Preferences.BackupLimits;

                /**
                 * Encodes the specified BackupLimits message. Does not implicitly {@link anki.config.Preferences.BackupLimits.verify|verify} messages.
                 * @param message BackupLimits message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.config.Preferences.BackupLimits.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a BackupLimits message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.config.Preferences.BackupLimits & anki.config.Preferences.BackupLimits.$Shape} BackupLimits
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.config.Preferences.BackupLimits & anki.config.Preferences.BackupLimits.$Shape;
            }

            namespace BackupLimits {

                /** Properties of a BackupLimits. */
                interface $Properties {

                    /** BackupLimits daily */
                    daily?: (number|null);

                    /** BackupLimits weekly */
                    weekly?: (number|null);

                    /** BackupLimits monthly */
                    monthly?: (number|null);

                    /** BackupLimits minimumIntervalMins */
                    minimumIntervalMins?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a BackupLimits. */
                type $Shape = anki.config.Preferences.BackupLimits.$Properties;
            }
        }
    }

    /** Namespace deck_config. */
    namespace deck_config {

        /** UpdateDeckConfigsMode enum. */
        enum UpdateDeckConfigsMode {

            /** UPDATE_DECK_CONFIGS_MODE_NORMAL value */
            UPDATE_DECK_CONFIGS_MODE_NORMAL = 0,

            /** UPDATE_DECK_CONFIGS_MODE_APPLY_TO_CHILDREN value */
            UPDATE_DECK_CONFIGS_MODE_APPLY_TO_CHILDREN = 1,

            /** UPDATE_DECK_CONFIGS_MODE_COMPUTE_ALL_PARAMS value */
            UPDATE_DECK_CONFIGS_MODE_COMPUTE_ALL_PARAMS = 2
        }

        /**
         * Properties of a DeckConfigId.
         * @deprecated Use anki.deck_config.DeckConfigId.$Properties instead.
         */
        interface IDeckConfigId extends anki.deck_config.DeckConfigId.$Properties {
        }

        /** Represents a DeckConfigId. */
        class DeckConfigId {

            /**
             * Constructs a new DeckConfigId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.deck_config.DeckConfigId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckConfigId dcid. */
            dcid: (number|Long);

            /**
             * Creates a new DeckConfigId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckConfigId instance
             */
            static create(properties: anki.deck_config.DeckConfigId.$Shape): anki.deck_config.DeckConfigId & anki.deck_config.DeckConfigId.$Shape;
            static create(properties?: anki.deck_config.DeckConfigId.$Properties): anki.deck_config.DeckConfigId;

            /**
             * Encodes the specified DeckConfigId message. Does not implicitly {@link anki.deck_config.DeckConfigId.verify|verify} messages.
             * @param message DeckConfigId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.deck_config.DeckConfigId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckConfigId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.deck_config.DeckConfigId & anki.deck_config.DeckConfigId.$Shape} DeckConfigId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfigId & anki.deck_config.DeckConfigId.$Shape;
        }

        namespace DeckConfigId {

            /** Properties of a DeckConfigId. */
            interface $Properties {

                /** DeckConfigId dcid */
                dcid?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckConfigId. */
            type $Shape = anki.deck_config.DeckConfigId.$Properties;
        }

        /**
         * Properties of a DeckConfig.
         * @deprecated Use anki.deck_config.DeckConfig.$Properties instead.
         */
        interface IDeckConfig extends anki.deck_config.DeckConfig.$Properties {
        }

        /** Represents a DeckConfig. */
        class DeckConfig {

            /**
             * Constructs a new DeckConfig.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.deck_config.DeckConfig.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckConfig id. */
            id: (number|Long);

            /** DeckConfig name. */
            name: string;

            /** DeckConfig mtimeSecs. */
            mtimeSecs: (number|Long);

            /** DeckConfig usn. */
            usn: number;

            /** DeckConfig config. */
            config?: (anki.deck_config.DeckConfig.Config.$Properties|null);

            /**
             * Creates a new DeckConfig instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckConfig instance
             */
            static create(properties: anki.deck_config.DeckConfig.$Shape): anki.deck_config.DeckConfig & anki.deck_config.DeckConfig.$Shape;
            static create(properties?: anki.deck_config.DeckConfig.$Properties): anki.deck_config.DeckConfig;

            /**
             * Encodes the specified DeckConfig message. Does not implicitly {@link anki.deck_config.DeckConfig.verify|verify} messages.
             * @param message DeckConfig message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.deck_config.DeckConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckConfig message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.deck_config.DeckConfig & anki.deck_config.DeckConfig.$Shape} DeckConfig
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfig & anki.deck_config.DeckConfig.$Shape;
        }

        namespace DeckConfig {

            /** Properties of a DeckConfig. */
            interface $Properties {

                /** DeckConfig id */
                id?: (number|Long|null);

                /** DeckConfig name */
                name?: (string|null);

                /** DeckConfig mtimeSecs */
                mtimeSecs?: (number|Long|null);

                /** DeckConfig usn */
                usn?: (number|null);

                /** DeckConfig config */
                config?: (anki.deck_config.DeckConfig.Config.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckConfig. */
            type $Shape = anki.deck_config.DeckConfig.$Properties;

            /**
             * Properties of a Config.
             * @deprecated Use anki.deck_config.DeckConfig.Config.$Properties instead.
             */
            interface IConfig extends anki.deck_config.DeckConfig.Config.$Properties {
            }

            /** Represents a Config. */
            class Config {

                /**
                 * Constructs a new Config.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.deck_config.DeckConfig.Config.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Config learnSteps. */
                learnSteps: number[];

                /** Config relearnSteps. */
                relearnSteps: number[];

                /** Config fsrsParams_4. */
                fsrsParams_4: number[];

                /** Config fsrsParams_5. */
                fsrsParams_5: number[];

                /** Config fsrsParams_6. */
                fsrsParams_6: number[];

                /** Config newPerDay. */
                newPerDay: number;

                /** Config reviewsPerDay. */
                reviewsPerDay: number;

                /** Config newPerDayMinimum. */
                newPerDayMinimum: number;

                /** Config initialEase. */
                initialEase: number;

                /** Config easyMultiplier. */
                easyMultiplier: number;

                /** Config hardMultiplier. */
                hardMultiplier: number;

                /** Config lapseMultiplier. */
                lapseMultiplier: number;

                /** Config intervalMultiplier. */
                intervalMultiplier: number;

                /** Config maximumReviewInterval. */
                maximumReviewInterval: number;

                /** Config minimumLapseInterval. */
                minimumLapseInterval: number;

                /** Config graduatingIntervalGood. */
                graduatingIntervalGood: number;

                /** Config graduatingIntervalEasy. */
                graduatingIntervalEasy: number;

                /** Config newCardInsertOrder. */
                newCardInsertOrder: anki.deck_config.DeckConfig.Config.NewCardInsertOrder;

                /** Config newCardGatherPriority. */
                newCardGatherPriority: anki.deck_config.DeckConfig.Config.NewCardGatherPriority;

                /** Config newCardSortOrder. */
                newCardSortOrder: anki.deck_config.DeckConfig.Config.NewCardSortOrder;

                /** Config newMix. */
                newMix: anki.deck_config.DeckConfig.Config.ReviewMix;

                /** Config reviewOrder. */
                reviewOrder: anki.deck_config.DeckConfig.Config.ReviewCardOrder;

                /** Config interdayLearningMix. */
                interdayLearningMix: anki.deck_config.DeckConfig.Config.ReviewMix;

                /** Config leechAction. */
                leechAction: anki.deck_config.DeckConfig.Config.LeechAction;

                /** Config leechThreshold. */
                leechThreshold: number;

                /** Config disableAutoplay. */
                disableAutoplay: boolean;

                /** Config capAnswerTimeToSecs. */
                capAnswerTimeToSecs: number;

                /** Config showTimer. */
                showTimer: boolean;

                /** Config stopTimerOnAnswer. */
                stopTimerOnAnswer: boolean;

                /** Config secondsToShowQuestion. */
                secondsToShowQuestion: number;

                /** Config secondsToShowAnswer. */
                secondsToShowAnswer: number;

                /** Config questionAction. */
                questionAction: anki.deck_config.DeckConfig.Config.QuestionAction;

                /** Config answerAction. */
                answerAction: anki.deck_config.DeckConfig.Config.AnswerAction;

                /** Config waitForAudio. */
                waitForAudio: boolean;

                /** Config skipQuestionWhenReplayingAnswer. */
                skipQuestionWhenReplayingAnswer: boolean;

                /** Config buryNew. */
                buryNew: boolean;

                /** Config buryReviews. */
                buryReviews: boolean;

                /** Config buryInterdayLearning. */
                buryInterdayLearning: boolean;

                /** Config desiredRetention. */
                desiredRetention: number;

                /** Config ignoreRevlogsBeforeDate. */
                ignoreRevlogsBeforeDate: string;

                /** Config easyDaysPercentages. */
                easyDaysPercentages: number[];

                /** Config historicalRetention. */
                historicalRetention: number;

                /** Config paramSearch. */
                paramSearch: string;

                /** Config other. */
                other: Uint8Array;

                /**
                 * Creates a new Config instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Config instance
                 */
                static create(properties: anki.deck_config.DeckConfig.Config.$Shape): anki.deck_config.DeckConfig.Config & anki.deck_config.DeckConfig.Config.$Shape;
                static create(properties?: anki.deck_config.DeckConfig.Config.$Properties): anki.deck_config.DeckConfig.Config;

                /**
                 * Encodes the specified Config message. Does not implicitly {@link anki.deck_config.DeckConfig.Config.verify|verify} messages.
                 * @param message Config message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.deck_config.DeckConfig.Config.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Config message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.deck_config.DeckConfig.Config & anki.deck_config.DeckConfig.Config.$Shape} Config
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfig.Config & anki.deck_config.DeckConfig.Config.$Shape;
            }

            namespace Config {

                /** Properties of a Config. */
                interface $Properties {

                    /** Config learnSteps */
                    learnSteps?: (number[]|null);

                    /** Config relearnSteps */
                    relearnSteps?: (number[]|null);

                    /** Config fsrsParams_4 */
                    fsrsParams_4?: (number[]|null);

                    /** Config fsrsParams_5 */
                    fsrsParams_5?: (number[]|null);

                    /** Config fsrsParams_6 */
                    fsrsParams_6?: (number[]|null);

                    /** Config newPerDay */
                    newPerDay?: (number|null);

                    /** Config reviewsPerDay */
                    reviewsPerDay?: (number|null);

                    /** Config newPerDayMinimum */
                    newPerDayMinimum?: (number|null);

                    /** Config initialEase */
                    initialEase?: (number|null);

                    /** Config easyMultiplier */
                    easyMultiplier?: (number|null);

                    /** Config hardMultiplier */
                    hardMultiplier?: (number|null);

                    /** Config lapseMultiplier */
                    lapseMultiplier?: (number|null);

                    /** Config intervalMultiplier */
                    intervalMultiplier?: (number|null);

                    /** Config maximumReviewInterval */
                    maximumReviewInterval?: (number|null);

                    /** Config minimumLapseInterval */
                    minimumLapseInterval?: (number|null);

                    /** Config graduatingIntervalGood */
                    graduatingIntervalGood?: (number|null);

                    /** Config graduatingIntervalEasy */
                    graduatingIntervalEasy?: (number|null);

                    /** Config newCardInsertOrder */
                    newCardInsertOrder?: (anki.deck_config.DeckConfig.Config.NewCardInsertOrder|null);

                    /** Config newCardGatherPriority */
                    newCardGatherPriority?: (anki.deck_config.DeckConfig.Config.NewCardGatherPriority|null);

                    /** Config newCardSortOrder */
                    newCardSortOrder?: (anki.deck_config.DeckConfig.Config.NewCardSortOrder|null);

                    /** Config newMix */
                    newMix?: (anki.deck_config.DeckConfig.Config.ReviewMix|null);

                    /** Config reviewOrder */
                    reviewOrder?: (anki.deck_config.DeckConfig.Config.ReviewCardOrder|null);

                    /** Config interdayLearningMix */
                    interdayLearningMix?: (anki.deck_config.DeckConfig.Config.ReviewMix|null);

                    /** Config leechAction */
                    leechAction?: (anki.deck_config.DeckConfig.Config.LeechAction|null);

                    /** Config leechThreshold */
                    leechThreshold?: (number|null);

                    /** Config disableAutoplay */
                    disableAutoplay?: (boolean|null);

                    /** Config capAnswerTimeToSecs */
                    capAnswerTimeToSecs?: (number|null);

                    /** Config showTimer */
                    showTimer?: (boolean|null);

                    /** Config stopTimerOnAnswer */
                    stopTimerOnAnswer?: (boolean|null);

                    /** Config secondsToShowQuestion */
                    secondsToShowQuestion?: (number|null);

                    /** Config secondsToShowAnswer */
                    secondsToShowAnswer?: (number|null);

                    /** Config questionAction */
                    questionAction?: (anki.deck_config.DeckConfig.Config.QuestionAction|null);

                    /** Config answerAction */
                    answerAction?: (anki.deck_config.DeckConfig.Config.AnswerAction|null);

                    /** Config waitForAudio */
                    waitForAudio?: (boolean|null);

                    /** Config skipQuestionWhenReplayingAnswer */
                    skipQuestionWhenReplayingAnswer?: (boolean|null);

                    /** Config buryNew */
                    buryNew?: (boolean|null);

                    /** Config buryReviews */
                    buryReviews?: (boolean|null);

                    /** Config buryInterdayLearning */
                    buryInterdayLearning?: (boolean|null);

                    /** Config desiredRetention */
                    desiredRetention?: (number|null);

                    /** Config ignoreRevlogsBeforeDate */
                    ignoreRevlogsBeforeDate?: (string|null);

                    /** Config easyDaysPercentages */
                    easyDaysPercentages?: (number[]|null);

                    /** Config historicalRetention */
                    historicalRetention?: (number|null);

                    /** Config paramSearch */
                    paramSearch?: (string|null);

                    /** Config other */
                    other?: (Uint8Array|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Config. */
                type $Shape = anki.deck_config.DeckConfig.Config.$Properties;

                /** NewCardInsertOrder enum. */
                enum NewCardInsertOrder {

                    /** NEW_CARD_INSERT_ORDER_DUE value */
                    NEW_CARD_INSERT_ORDER_DUE = 0,

                    /** NEW_CARD_INSERT_ORDER_RANDOM value */
                    NEW_CARD_INSERT_ORDER_RANDOM = 1
                }

                /** NewCardGatherPriority enum. */
                enum NewCardGatherPriority {

                    /** NEW_CARD_GATHER_PRIORITY_DECK value */
                    NEW_CARD_GATHER_PRIORITY_DECK = 0,

                    /** NEW_CARD_GATHER_PRIORITY_DECK_THEN_RANDOM_NOTES value */
                    NEW_CARD_GATHER_PRIORITY_DECK_THEN_RANDOM_NOTES = 5,

                    /** NEW_CARD_GATHER_PRIORITY_LOWEST_POSITION value */
                    NEW_CARD_GATHER_PRIORITY_LOWEST_POSITION = 1,

                    /** NEW_CARD_GATHER_PRIORITY_HIGHEST_POSITION value */
                    NEW_CARD_GATHER_PRIORITY_HIGHEST_POSITION = 2,

                    /** NEW_CARD_GATHER_PRIORITY_RANDOM_NOTES value */
                    NEW_CARD_GATHER_PRIORITY_RANDOM_NOTES = 3,

                    /** NEW_CARD_GATHER_PRIORITY_RANDOM_CARDS value */
                    NEW_CARD_GATHER_PRIORITY_RANDOM_CARDS = 4
                }

                /** NewCardSortOrder enum. */
                enum NewCardSortOrder {

                    /** NEW_CARD_SORT_ORDER_TEMPLATE value */
                    NEW_CARD_SORT_ORDER_TEMPLATE = 0,

                    /** NEW_CARD_SORT_ORDER_NO_SORT value */
                    NEW_CARD_SORT_ORDER_NO_SORT = 1,

                    /** NEW_CARD_SORT_ORDER_TEMPLATE_THEN_RANDOM value */
                    NEW_CARD_SORT_ORDER_TEMPLATE_THEN_RANDOM = 2,

                    /** NEW_CARD_SORT_ORDER_RANDOM_NOTE_THEN_TEMPLATE value */
                    NEW_CARD_SORT_ORDER_RANDOM_NOTE_THEN_TEMPLATE = 3,

                    /** NEW_CARD_SORT_ORDER_RANDOM_CARD value */
                    NEW_CARD_SORT_ORDER_RANDOM_CARD = 4
                }

                /** ReviewCardOrder enum. */
                enum ReviewCardOrder {

                    /** REVIEW_CARD_ORDER_DAY value */
                    REVIEW_CARD_ORDER_DAY = 0,

                    /** REVIEW_CARD_ORDER_DAY_THEN_DECK value */
                    REVIEW_CARD_ORDER_DAY_THEN_DECK = 1,

                    /** REVIEW_CARD_ORDER_DECK_THEN_DAY value */
                    REVIEW_CARD_ORDER_DECK_THEN_DAY = 2,

                    /** REVIEW_CARD_ORDER_INTERVALS_ASCENDING value */
                    REVIEW_CARD_ORDER_INTERVALS_ASCENDING = 3,

                    /** REVIEW_CARD_ORDER_INTERVALS_DESCENDING value */
                    REVIEW_CARD_ORDER_INTERVALS_DESCENDING = 4,

                    /** REVIEW_CARD_ORDER_EASE_ASCENDING value */
                    REVIEW_CARD_ORDER_EASE_ASCENDING = 5,

                    /** REVIEW_CARD_ORDER_EASE_DESCENDING value */
                    REVIEW_CARD_ORDER_EASE_DESCENDING = 6,

                    /** REVIEW_CARD_ORDER_RETRIEVABILITY_ASCENDING value */
                    REVIEW_CARD_ORDER_RETRIEVABILITY_ASCENDING = 7,

                    /** REVIEW_CARD_ORDER_RETRIEVABILITY_DESCENDING value */
                    REVIEW_CARD_ORDER_RETRIEVABILITY_DESCENDING = 11,

                    /** REVIEW_CARD_ORDER_RELATIVE_OVERDUENESS value */
                    REVIEW_CARD_ORDER_RELATIVE_OVERDUENESS = 12,

                    /** REVIEW_CARD_ORDER_RANDOM value */
                    REVIEW_CARD_ORDER_RANDOM = 8,

                    /** REVIEW_CARD_ORDER_ADDED value */
                    REVIEW_CARD_ORDER_ADDED = 9,

                    /** REVIEW_CARD_ORDER_REVERSE_ADDED value */
                    REVIEW_CARD_ORDER_REVERSE_ADDED = 10
                }

                /** ReviewMix enum. */
                enum ReviewMix {

                    /** REVIEW_MIX_MIX_WITH_REVIEWS value */
                    REVIEW_MIX_MIX_WITH_REVIEWS = 0,

                    /** REVIEW_MIX_AFTER_REVIEWS value */
                    REVIEW_MIX_AFTER_REVIEWS = 1,

                    /** REVIEW_MIX_BEFORE_REVIEWS value */
                    REVIEW_MIX_BEFORE_REVIEWS = 2
                }

                /** LeechAction enum. */
                enum LeechAction {

                    /** LEECH_ACTION_SUSPEND value */
                    LEECH_ACTION_SUSPEND = 0,

                    /** LEECH_ACTION_TAG_ONLY value */
                    LEECH_ACTION_TAG_ONLY = 1
                }

                /** AnswerAction enum. */
                enum AnswerAction {

                    /** ANSWER_ACTION_BURY_CARD value */
                    ANSWER_ACTION_BURY_CARD = 0,

                    /** ANSWER_ACTION_ANSWER_AGAIN value */
                    ANSWER_ACTION_ANSWER_AGAIN = 1,

                    /** ANSWER_ACTION_ANSWER_GOOD value */
                    ANSWER_ACTION_ANSWER_GOOD = 2,

                    /** ANSWER_ACTION_ANSWER_HARD value */
                    ANSWER_ACTION_ANSWER_HARD = 3,

                    /** ANSWER_ACTION_SHOW_REMINDER value */
                    ANSWER_ACTION_SHOW_REMINDER = 4
                }

                /** QuestionAction enum. */
                enum QuestionAction {

                    /** QUESTION_ACTION_SHOW_ANSWER value */
                    QUESTION_ACTION_SHOW_ANSWER = 0,

                    /** QUESTION_ACTION_SHOW_REMINDER value */
                    QUESTION_ACTION_SHOW_REMINDER = 1
                }
            }
        }

        /**
         * Properties of a DeckConfigsForUpdate.
         * @deprecated Use anki.deck_config.DeckConfigsForUpdate.$Properties instead.
         */
        interface IDeckConfigsForUpdate extends anki.deck_config.DeckConfigsForUpdate.$Properties {
        }

        /** Represents a DeckConfigsForUpdate. */
        class DeckConfigsForUpdate {

            /**
             * Constructs a new DeckConfigsForUpdate.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.deck_config.DeckConfigsForUpdate.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckConfigsForUpdate allConfig. */
            allConfig: anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties[];

            /** DeckConfigsForUpdate currentDeck. */
            currentDeck?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties|null);

            /** DeckConfigsForUpdate defaults. */
            defaults?: (anki.deck_config.DeckConfig.$Properties|null);

            /** DeckConfigsForUpdate schemaModified. */
            schemaModified: boolean;

            /** DeckConfigsForUpdate cardStateCustomizer. */
            cardStateCustomizer: string;

            /** DeckConfigsForUpdate newCardsIgnoreReviewLimit. */
            newCardsIgnoreReviewLimit: boolean;

            /** DeckConfigsForUpdate fsrs. */
            fsrs: boolean;

            /** DeckConfigsForUpdate fsrsHealthCheck. */
            fsrsHealthCheck: boolean;

            /** DeckConfigsForUpdate fsrsLegacyEvaluate. */
            fsrsLegacyEvaluate: boolean;

            /** DeckConfigsForUpdate applyAllParentLimits. */
            applyAllParentLimits: boolean;

            /** DeckConfigsForUpdate daysSinceLastFsrsOptimize. */
            daysSinceLastFsrsOptimize: number;

            /**
             * Creates a new DeckConfigsForUpdate instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckConfigsForUpdate instance
             */
            static create(properties: anki.deck_config.DeckConfigsForUpdate.$Shape): anki.deck_config.DeckConfigsForUpdate & anki.deck_config.DeckConfigsForUpdate.$Shape;
            static create(properties?: anki.deck_config.DeckConfigsForUpdate.$Properties): anki.deck_config.DeckConfigsForUpdate;

            /**
             * Encodes the specified DeckConfigsForUpdate message. Does not implicitly {@link anki.deck_config.DeckConfigsForUpdate.verify|verify} messages.
             * @param message DeckConfigsForUpdate message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.deck_config.DeckConfigsForUpdate.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckConfigsForUpdate message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.deck_config.DeckConfigsForUpdate & anki.deck_config.DeckConfigsForUpdate.$Shape} DeckConfigsForUpdate
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfigsForUpdate & anki.deck_config.DeckConfigsForUpdate.$Shape;
        }

        namespace DeckConfigsForUpdate {

            /** Properties of a DeckConfigsForUpdate. */
            interface $Properties {

                /** DeckConfigsForUpdate allConfig */
                allConfig?: (anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties[]|null);

                /** DeckConfigsForUpdate currentDeck */
                currentDeck?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties|null);

                /** DeckConfigsForUpdate defaults */
                defaults?: (anki.deck_config.DeckConfig.$Properties|null);

                /** DeckConfigsForUpdate schemaModified */
                schemaModified?: (boolean|null);

                /** DeckConfigsForUpdate cardStateCustomizer */
                cardStateCustomizer?: (string|null);

                /** DeckConfigsForUpdate newCardsIgnoreReviewLimit */
                newCardsIgnoreReviewLimit?: (boolean|null);

                /** DeckConfigsForUpdate fsrs */
                fsrs?: (boolean|null);

                /** DeckConfigsForUpdate fsrsHealthCheck */
                fsrsHealthCheck?: (boolean|null);

                /** DeckConfigsForUpdate fsrsLegacyEvaluate */
                fsrsLegacyEvaluate?: (boolean|null);

                /** DeckConfigsForUpdate applyAllParentLimits */
                applyAllParentLimits?: (boolean|null);

                /** DeckConfigsForUpdate daysSinceLastFsrsOptimize */
                daysSinceLastFsrsOptimize?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckConfigsForUpdate. */
            type $Shape = anki.deck_config.DeckConfigsForUpdate.$Properties;

            /**
             * Properties of a ConfigWithExtra.
             * @deprecated Use anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties instead.
             */
            interface IConfigWithExtra extends anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties {
            }

            /** Represents a ConfigWithExtra. */
            class ConfigWithExtra {

                /**
                 * Constructs a new ConfigWithExtra.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** ConfigWithExtra config. */
                config?: (anki.deck_config.DeckConfig.$Properties|null);

                /** ConfigWithExtra useCount. */
                useCount: number;

                /**
                 * Creates a new ConfigWithExtra instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ConfigWithExtra instance
                 */
                static create(properties: anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Shape): anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra & anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Shape;
                static create(properties?: anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties): anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra;

                /**
                 * Encodes the specified ConfigWithExtra message. Does not implicitly {@link anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.verify|verify} messages.
                 * @param message ConfigWithExtra message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a ConfigWithExtra message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra & anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Shape} ConfigWithExtra
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra & anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Shape;
            }

            namespace ConfigWithExtra {

                /** Properties of a ConfigWithExtra. */
                interface $Properties {

                    /** ConfigWithExtra config */
                    config?: (anki.deck_config.DeckConfig.$Properties|null);

                    /** ConfigWithExtra useCount */
                    useCount?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a ConfigWithExtra. */
                type $Shape = anki.deck_config.DeckConfigsForUpdate.ConfigWithExtra.$Properties;
            }

            /**
             * Properties of a CurrentDeck.
             * @deprecated Use anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties instead.
             */
            interface ICurrentDeck extends anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties {
            }

            /** Represents a CurrentDeck. */
            class CurrentDeck {

                /**
                 * Constructs a new CurrentDeck.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** CurrentDeck name. */
                name: string;

                /** CurrentDeck configId. */
                configId: (number|Long);

                /** CurrentDeck parentConfigIds. */
                parentConfigIds: (number|Long)[];

                /** CurrentDeck limits. */
                limits?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties|null);

                /**
                 * Creates a new CurrentDeck instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns CurrentDeck instance
                 */
                static create(properties: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Shape): anki.deck_config.DeckConfigsForUpdate.CurrentDeck & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Shape;
                static create(properties?: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties): anki.deck_config.DeckConfigsForUpdate.CurrentDeck;

                /**
                 * Encodes the specified CurrentDeck message. Does not implicitly {@link anki.deck_config.DeckConfigsForUpdate.CurrentDeck.verify|verify} messages.
                 * @param message CurrentDeck message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a CurrentDeck message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.deck_config.DeckConfigsForUpdate.CurrentDeck & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Shape} CurrentDeck
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfigsForUpdate.CurrentDeck & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Shape;
            }

            namespace CurrentDeck {

                /** Properties of a CurrentDeck. */
                interface $Properties {

                    /** CurrentDeck name */
                    name?: (string|null);

                    /** CurrentDeck configId */
                    configId?: (number|Long|null);

                    /** CurrentDeck parentConfigIds */
                    parentConfigIds?: ((number|Long)[]|null);

                    /** CurrentDeck limits */
                    limits?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a CurrentDeck. */
                type $Shape = anki.deck_config.DeckConfigsForUpdate.CurrentDeck.$Properties;

                /**
                 * Properties of a Limits.
                 * @deprecated Use anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties instead.
                 */
                interface ILimits extends anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties {
                }

                /** Represents a Limits. */
                class Limits {

                    /**
                     * Constructs a new Limits.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Limits review. */
                    review?: (number|null);

                    /** Limits new. */
                    new?: (number|null);

                    /** Limits reviewToday. */
                    reviewToday?: (number|null);

                    /** Limits newToday. */
                    newToday?: (number|null);

                    /** Limits reviewTodayActive. */
                    reviewTodayActive: boolean;

                    /** Limits newTodayActive. */
                    newTodayActive: boolean;

                    /** Limits desiredRetention. */
                    desiredRetention?: (number|null);

                    /**
                     * Creates a new Limits instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Limits instance
                     */
                    static create(properties: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Shape): anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Shape;
                    static create(properties?: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties): anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits;

                    /**
                     * Encodes the specified Limits message. Does not implicitly {@link anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.verify|verify} messages.
                     * @param message Limits message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Limits message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Shape} Limits
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits & anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Shape;
                }

                namespace Limits {

                    /** Properties of a Limits. */
                    interface $Properties {

                        /** Limits review */
                        review?: (number|null);

                        /** Limits new */
                        "new"?: (number|null);

                        /** Limits reviewToday */
                        reviewToday?: (number|null);

                        /** Limits newToday */
                        newToday?: (number|null);

                        /** Limits reviewTodayActive */
                        reviewTodayActive?: (boolean|null);

                        /** Limits newTodayActive */
                        newTodayActive?: (boolean|null);

                        /** Limits desiredRetention */
                        desiredRetention?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a Limits. */
                    type $Shape = anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties;
                }
            }
        }

        /**
         * Properties of an UpdateDeckConfigsRequest.
         * @deprecated Use anki.deck_config.UpdateDeckConfigsRequest.$Properties instead.
         */
        interface IUpdateDeckConfigsRequest extends anki.deck_config.UpdateDeckConfigsRequest.$Properties {
        }

        /** Represents an UpdateDeckConfigsRequest. */
        class UpdateDeckConfigsRequest {

            /**
             * Constructs a new UpdateDeckConfigsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.deck_config.UpdateDeckConfigsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UpdateDeckConfigsRequest targetDeckId. */
            targetDeckId: (number|Long);

            /** UpdateDeckConfigsRequest configs. */
            configs: anki.deck_config.DeckConfig.$Properties[];

            /** UpdateDeckConfigsRequest removedConfigIds. */
            removedConfigIds: (number|Long)[];

            /** UpdateDeckConfigsRequest mode. */
            mode: anki.deck_config.UpdateDeckConfigsMode;

            /** UpdateDeckConfigsRequest cardStateCustomizer. */
            cardStateCustomizer: string;

            /** UpdateDeckConfigsRequest limits. */
            limits?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties|null);

            /** UpdateDeckConfigsRequest newCardsIgnoreReviewLimit. */
            newCardsIgnoreReviewLimit: boolean;

            /** UpdateDeckConfigsRequest fsrs. */
            fsrs: boolean;

            /** UpdateDeckConfigsRequest applyAllParentLimits. */
            applyAllParentLimits: boolean;

            /** UpdateDeckConfigsRequest fsrsReschedule. */
            fsrsReschedule: boolean;

            /** UpdateDeckConfigsRequest fsrsHealthCheck. */
            fsrsHealthCheck: boolean;

            /**
             * Creates a new UpdateDeckConfigsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UpdateDeckConfigsRequest instance
             */
            static create(properties: anki.deck_config.UpdateDeckConfigsRequest.$Shape): anki.deck_config.UpdateDeckConfigsRequest & anki.deck_config.UpdateDeckConfigsRequest.$Shape;
            static create(properties?: anki.deck_config.UpdateDeckConfigsRequest.$Properties): anki.deck_config.UpdateDeckConfigsRequest;

            /**
             * Encodes the specified UpdateDeckConfigsRequest message. Does not implicitly {@link anki.deck_config.UpdateDeckConfigsRequest.verify|verify} messages.
             * @param message UpdateDeckConfigsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.deck_config.UpdateDeckConfigsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UpdateDeckConfigsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.deck_config.UpdateDeckConfigsRequest & anki.deck_config.UpdateDeckConfigsRequest.$Shape} UpdateDeckConfigsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.deck_config.UpdateDeckConfigsRequest & anki.deck_config.UpdateDeckConfigsRequest.$Shape;
        }

        namespace UpdateDeckConfigsRequest {

            /** Properties of an UpdateDeckConfigsRequest. */
            interface $Properties {

                /** UpdateDeckConfigsRequest targetDeckId */
                targetDeckId?: (number|Long|null);

                /** UpdateDeckConfigsRequest configs */
                configs?: (anki.deck_config.DeckConfig.$Properties[]|null);

                /** UpdateDeckConfigsRequest removedConfigIds */
                removedConfigIds?: ((number|Long)[]|null);

                /** UpdateDeckConfigsRequest mode */
                mode?: (anki.deck_config.UpdateDeckConfigsMode|null);

                /** UpdateDeckConfigsRequest cardStateCustomizer */
                cardStateCustomizer?: (string|null);

                /** UpdateDeckConfigsRequest limits */
                limits?: (anki.deck_config.DeckConfigsForUpdate.CurrentDeck.Limits.$Properties|null);

                /** UpdateDeckConfigsRequest newCardsIgnoreReviewLimit */
                newCardsIgnoreReviewLimit?: (boolean|null);

                /** UpdateDeckConfigsRequest fsrs */
                fsrs?: (boolean|null);

                /** UpdateDeckConfigsRequest applyAllParentLimits */
                applyAllParentLimits?: (boolean|null);

                /** UpdateDeckConfigsRequest fsrsReschedule */
                fsrsReschedule?: (boolean|null);

                /** UpdateDeckConfigsRequest fsrsHealthCheck */
                fsrsHealthCheck?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an UpdateDeckConfigsRequest. */
            type $Shape = anki.deck_config.UpdateDeckConfigsRequest.$Properties;
        }
    }

    /** Namespace decks. */
    namespace decks {

        /**
         * Properties of a DeckId.
         * @deprecated Use anki.decks.DeckId.$Properties instead.
         */
        interface IDeckId extends anki.decks.DeckId.$Properties {
        }

        /** Represents a DeckId. */
        class DeckId {

            /**
             * Constructs a new DeckId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckId did. */
            did: (number|Long);

            /**
             * Creates a new DeckId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckId instance
             */
            static create(properties: anki.decks.DeckId.$Shape): anki.decks.DeckId & anki.decks.DeckId.$Shape;
            static create(properties?: anki.decks.DeckId.$Properties): anki.decks.DeckId;

            /**
             * Encodes the specified DeckId message. Does not implicitly {@link anki.decks.DeckId.verify|verify} messages.
             * @param message DeckId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckId & anki.decks.DeckId.$Shape} DeckId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckId & anki.decks.DeckId.$Shape;
        }

        namespace DeckId {

            /** Properties of a DeckId. */
            interface $Properties {

                /** DeckId did */
                did?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckId. */
            type $Shape = anki.decks.DeckId.$Properties;
        }

        /**
         * Properties of a DeckIds.
         * @deprecated Use anki.decks.DeckIds.$Properties instead.
         */
        interface IDeckIds extends anki.decks.DeckIds.$Properties {
        }

        /** Represents a DeckIds. */
        class DeckIds {

            /**
             * Constructs a new DeckIds.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckIds.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckIds dids. */
            dids: (number|Long)[];

            /**
             * Creates a new DeckIds instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckIds instance
             */
            static create(properties: anki.decks.DeckIds.$Shape): anki.decks.DeckIds & anki.decks.DeckIds.$Shape;
            static create(properties?: anki.decks.DeckIds.$Properties): anki.decks.DeckIds;

            /**
             * Encodes the specified DeckIds message. Does not implicitly {@link anki.decks.DeckIds.verify|verify} messages.
             * @param message DeckIds message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckIds.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckIds message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckIds & anki.decks.DeckIds.$Shape} DeckIds
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckIds & anki.decks.DeckIds.$Shape;
        }

        namespace DeckIds {

            /** Properties of a DeckIds. */
            interface $Properties {

                /** DeckIds dids */
                dids?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckIds. */
            type $Shape = anki.decks.DeckIds.$Properties;
        }

        /**
         * Properties of a Deck.
         * @deprecated Use anki.decks.Deck.$Properties instead.
         */
        interface IDeck extends anki.decks.Deck.$Properties {
        }

        /** Represents a Deck. */
        class Deck {

            /**
             * Constructs a new Deck.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.Deck.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** Deck id. */
            id: (number|Long);

            /** Deck name. */
            name: string;

            /** Deck mtimeSecs. */
            mtimeSecs: (number|Long);

            /** Deck usn. */
            usn: number;

            /** Deck common. */
            common?: (anki.decks.Deck.Common.$Properties|null);

            /** Deck normal. */
            normal?: (anki.decks.Deck.Normal.$Properties|null);

            /** Deck filtered. */
            filtered?: (anki.decks.Deck.Filtered.$Properties|null);

            /** Deck kind. */
            kind?: ("normal"|"filtered");

            /**
             * Creates a new Deck instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Deck instance
             */
            static create(properties: anki.decks.Deck.$Shape): anki.decks.Deck & anki.decks.Deck.$Shape;
            static create(properties?: anki.decks.Deck.$Properties): anki.decks.Deck;

            /**
             * Encodes the specified Deck message. Does not implicitly {@link anki.decks.Deck.verify|verify} messages.
             * @param message Deck message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.Deck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Deck message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.Deck & anki.decks.Deck.$Shape} Deck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck & anki.decks.Deck.$Shape;
        }

        namespace Deck {

            /** Properties of a Deck. */
            interface $Properties {

                /** Deck id */
                id?: (number|Long|null);

                /** Deck name */
                name?: (string|null);

                /** Deck mtimeSecs */
                mtimeSecs?: (number|Long|null);

                /** Deck usn */
                usn?: (number|null);

                /** Deck common */
                common?: (anki.decks.Deck.Common.$Properties|null);

                /** Deck normal */
                normal?: (anki.decks.Deck.Normal.$Properties|null);

                /** Deck filtered */
                filtered?: (anki.decks.Deck.Filtered.$Properties|null);

                /** Deck kind */
                kind?: ("normal"|"filtered");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a Deck. */
            type $Shape = {
              id?: number|Long|null;
              name?: string|null;
              mtimeSecs?: number|Long|null;
              usn?: number|null;
              common?: anki.decks.Deck.Common.$Shape|null;
              normal?: anki.decks.Deck.Normal.$Shape|null;
              filtered?: anki.decks.Deck.Filtered.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ kind?: undefined; normal?: null; filtered?: null }|{ kind?: "normal"; normal: anki.decks.Deck.Normal.$Shape; filtered?: null }|{ kind?: "filtered"; normal?: null; filtered: anki.decks.Deck.Filtered.$Shape })
            );

            /**
             * Properties of a Common.
             * @deprecated Use anki.decks.Deck.Common.$Properties instead.
             */
            interface ICommon extends anki.decks.Deck.Common.$Properties {
            }

            /** Represents a Common. */
            class Common {

                /**
                 * Constructs a new Common.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.decks.Deck.Common.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Common studyCollapsed. */
                studyCollapsed: boolean;

                /** Common browserCollapsed. */
                browserCollapsed: boolean;

                /** Common lastDayStudied. */
                lastDayStudied: number;

                /** Common newStudied. */
                newStudied: number;

                /** Common reviewStudied. */
                reviewStudied: number;

                /** Common millisecondsStudied. */
                millisecondsStudied: number;

                /** Common learningStudied. */
                learningStudied: number;

                /** Common other. */
                other: Uint8Array;

                /**
                 * Creates a new Common instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Common instance
                 */
                static create(properties: anki.decks.Deck.Common.$Shape): anki.decks.Deck.Common & anki.decks.Deck.Common.$Shape;
                static create(properties?: anki.decks.Deck.Common.$Properties): anki.decks.Deck.Common;

                /**
                 * Encodes the specified Common message. Does not implicitly {@link anki.decks.Deck.Common.verify|verify} messages.
                 * @param message Common message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.decks.Deck.Common.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Common message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.decks.Deck.Common & anki.decks.Deck.Common.$Shape} Common
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck.Common & anki.decks.Deck.Common.$Shape;
            }

            namespace Common {

                /** Properties of a Common. */
                interface $Properties {

                    /** Common studyCollapsed */
                    studyCollapsed?: (boolean|null);

                    /** Common browserCollapsed */
                    browserCollapsed?: (boolean|null);

                    /** Common lastDayStudied */
                    lastDayStudied?: (number|null);

                    /** Common newStudied */
                    newStudied?: (number|null);

                    /** Common reviewStudied */
                    reviewStudied?: (number|null);

                    /** Common millisecondsStudied */
                    millisecondsStudied?: (number|null);

                    /** Common learningStudied */
                    learningStudied?: (number|null);

                    /** Common other */
                    other?: (Uint8Array|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Common. */
                type $Shape = anki.decks.Deck.Common.$Properties;
            }

            /**
             * Properties of a Normal.
             * @deprecated Use anki.decks.Deck.Normal.$Properties instead.
             */
            interface INormal extends anki.decks.Deck.Normal.$Properties {
            }

            /** Represents a Normal. */
            class Normal {

                /**
                 * Constructs a new Normal.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.decks.Deck.Normal.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Normal configId. */
                configId: (number|Long);

                /** Normal extendNew. */
                extendNew: number;

                /** Normal extendReview. */
                extendReview: number;

                /** Normal description. */
                description: string;

                /** Normal markdownDescription. */
                markdownDescription: boolean;

                /** Normal reviewLimit. */
                reviewLimit?: (number|null);

                /** Normal newLimit. */
                newLimit?: (number|null);

                /** Normal reviewLimitToday. */
                reviewLimitToday?: (anki.decks.Deck.Normal.DayLimit.$Properties|null);

                /** Normal newLimitToday. */
                newLimitToday?: (anki.decks.Deck.Normal.DayLimit.$Properties|null);

                /** Normal desiredRetention. */
                desiredRetention?: (number|null);

                /**
                 * Creates a new Normal instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Normal instance
                 */
                static create(properties: anki.decks.Deck.Normal.$Shape): anki.decks.Deck.Normal & anki.decks.Deck.Normal.$Shape;
                static create(properties?: anki.decks.Deck.Normal.$Properties): anki.decks.Deck.Normal;

                /**
                 * Encodes the specified Normal message. Does not implicitly {@link anki.decks.Deck.Normal.verify|verify} messages.
                 * @param message Normal message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.decks.Deck.Normal.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Normal message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.decks.Deck.Normal & anki.decks.Deck.Normal.$Shape} Normal
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck.Normal & anki.decks.Deck.Normal.$Shape;
            }

            namespace Normal {

                /** Properties of a Normal. */
                interface $Properties {

                    /** Normal configId */
                    configId?: (number|Long|null);

                    /** Normal extendNew */
                    extendNew?: (number|null);

                    /** Normal extendReview */
                    extendReview?: (number|null);

                    /** Normal description */
                    description?: (string|null);

                    /** Normal markdownDescription */
                    markdownDescription?: (boolean|null);

                    /** Normal reviewLimit */
                    reviewLimit?: (number|null);

                    /** Normal newLimit */
                    newLimit?: (number|null);

                    /** Normal reviewLimitToday */
                    reviewLimitToday?: (anki.decks.Deck.Normal.DayLimit.$Properties|null);

                    /** Normal newLimitToday */
                    newLimitToday?: (anki.decks.Deck.Normal.DayLimit.$Properties|null);

                    /** Normal desiredRetention */
                    desiredRetention?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Normal. */
                type $Shape = anki.decks.Deck.Normal.$Properties;

                /**
                 * Properties of a DayLimit.
                 * @deprecated Use anki.decks.Deck.Normal.DayLimit.$Properties instead.
                 */
                interface IDayLimit extends anki.decks.Deck.Normal.DayLimit.$Properties {
                }

                /** Represents a DayLimit. */
                class DayLimit {

                    /**
                     * Constructs a new DayLimit.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.decks.Deck.Normal.DayLimit.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** DayLimit limit. */
                    limit: number;

                    /** DayLimit today. */
                    today: number;

                    /**
                     * Creates a new DayLimit instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DayLimit instance
                     */
                    static create(properties: anki.decks.Deck.Normal.DayLimit.$Shape): anki.decks.Deck.Normal.DayLimit & anki.decks.Deck.Normal.DayLimit.$Shape;
                    static create(properties?: anki.decks.Deck.Normal.DayLimit.$Properties): anki.decks.Deck.Normal.DayLimit;

                    /**
                     * Encodes the specified DayLimit message. Does not implicitly {@link anki.decks.Deck.Normal.DayLimit.verify|verify} messages.
                     * @param message DayLimit message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.decks.Deck.Normal.DayLimit.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DayLimit message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.decks.Deck.Normal.DayLimit & anki.decks.Deck.Normal.DayLimit.$Shape} DayLimit
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck.Normal.DayLimit & anki.decks.Deck.Normal.DayLimit.$Shape;
                }

                namespace DayLimit {

                    /** Properties of a DayLimit. */
                    interface $Properties {

                        /** DayLimit limit */
                        limit?: (number|null);

                        /** DayLimit today */
                        today?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a DayLimit. */
                    type $Shape = anki.decks.Deck.Normal.DayLimit.$Properties;
                }
            }

            /**
             * Properties of a Filtered.
             * @deprecated Use anki.decks.Deck.Filtered.$Properties instead.
             */
            interface IFiltered extends anki.decks.Deck.Filtered.$Properties {
            }

            /** Represents a Filtered. */
            class Filtered {

                /**
                 * Constructs a new Filtered.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.decks.Deck.Filtered.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Filtered reschedule. */
                reschedule: boolean;

                /** Filtered searchTerms. */
                searchTerms: anki.decks.Deck.Filtered.SearchTerm.$Properties[];

                /** Filtered delays. */
                delays: number[];

                /** Filtered previewDelay. */
                previewDelay: number;

                /** Filtered previewAgainSecs. */
                previewAgainSecs: number;

                /** Filtered previewHardSecs. */
                previewHardSecs: number;

                /** Filtered previewGoodSecs. */
                previewGoodSecs: number;

                /**
                 * Creates a new Filtered instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Filtered instance
                 */
                static create(properties: anki.decks.Deck.Filtered.$Shape): anki.decks.Deck.Filtered & anki.decks.Deck.Filtered.$Shape;
                static create(properties?: anki.decks.Deck.Filtered.$Properties): anki.decks.Deck.Filtered;

                /**
                 * Encodes the specified Filtered message. Does not implicitly {@link anki.decks.Deck.Filtered.verify|verify} messages.
                 * @param message Filtered message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.decks.Deck.Filtered.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Filtered message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.decks.Deck.Filtered & anki.decks.Deck.Filtered.$Shape} Filtered
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck.Filtered & anki.decks.Deck.Filtered.$Shape;
            }

            namespace Filtered {

                /** Properties of a Filtered. */
                interface $Properties {

                    /** Filtered reschedule */
                    reschedule?: (boolean|null);

                    /** Filtered searchTerms */
                    searchTerms?: (anki.decks.Deck.Filtered.SearchTerm.$Properties[]|null);

                    /** Filtered delays */
                    delays?: (number[]|null);

                    /** Filtered previewDelay */
                    previewDelay?: (number|null);

                    /** Filtered previewAgainSecs */
                    previewAgainSecs?: (number|null);

                    /** Filtered previewHardSecs */
                    previewHardSecs?: (number|null);

                    /** Filtered previewGoodSecs */
                    previewGoodSecs?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Filtered. */
                type $Shape = anki.decks.Deck.Filtered.$Properties;

                /**
                 * Properties of a SearchTerm.
                 * @deprecated Use anki.decks.Deck.Filtered.SearchTerm.$Properties instead.
                 */
                interface ISearchTerm extends anki.decks.Deck.Filtered.SearchTerm.$Properties {
                }

                /** Represents a SearchTerm. */
                class SearchTerm {

                    /**
                     * Constructs a new SearchTerm.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.decks.Deck.Filtered.SearchTerm.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** SearchTerm search. */
                    search: string;

                    /** SearchTerm limit. */
                    limit: number;

                    /** SearchTerm order. */
                    order: anki.decks.Deck.Filtered.SearchTerm.Order;

                    /**
                     * Creates a new SearchTerm instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SearchTerm instance
                     */
                    static create(properties: anki.decks.Deck.Filtered.SearchTerm.$Shape): anki.decks.Deck.Filtered.SearchTerm & anki.decks.Deck.Filtered.SearchTerm.$Shape;
                    static create(properties?: anki.decks.Deck.Filtered.SearchTerm.$Properties): anki.decks.Deck.Filtered.SearchTerm;

                    /**
                     * Encodes the specified SearchTerm message. Does not implicitly {@link anki.decks.Deck.Filtered.SearchTerm.verify|verify} messages.
                     * @param message SearchTerm message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.decks.Deck.Filtered.SearchTerm.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SearchTerm message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.decks.Deck.Filtered.SearchTerm & anki.decks.Deck.Filtered.SearchTerm.$Shape} SearchTerm
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.Deck.Filtered.SearchTerm & anki.decks.Deck.Filtered.SearchTerm.$Shape;
                }

                namespace SearchTerm {

                    /** Properties of a SearchTerm. */
                    interface $Properties {

                        /** SearchTerm search */
                        search?: (string|null);

                        /** SearchTerm limit */
                        limit?: (number|null);

                        /** SearchTerm order */
                        order?: (anki.decks.Deck.Filtered.SearchTerm.Order|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a SearchTerm. */
                    type $Shape = anki.decks.Deck.Filtered.SearchTerm.$Properties;

                    /** Order enum. */
                    enum Order {

                        /** OLDEST_REVIEWED_FIRST value */
                        OLDEST_REVIEWED_FIRST = 0,

                        /** RANDOM value */
                        RANDOM = 1,

                        /** INTERVALS_ASCENDING value */
                        INTERVALS_ASCENDING = 2,

                        /** INTERVALS_DESCENDING value */
                        INTERVALS_DESCENDING = 3,

                        /** LAPSES value */
                        LAPSES = 4,

                        /** ADDED value */
                        ADDED = 5,

                        /** DUE value */
                        DUE = 6,

                        /** REVERSE_ADDED value */
                        REVERSE_ADDED = 7,

                        /** RETRIEVABILITY_ASCENDING value */
                        RETRIEVABILITY_ASCENDING = 8,

                        /** RETRIEVABILITY_DESCENDING value */
                        RETRIEVABILITY_DESCENDING = 9,

                        /** RELATIVE_OVERDUENESS value */
                        RELATIVE_OVERDUENESS = 10
                    }
                }
            }
        }

        /**
         * Properties of a DeckTreeRequest.
         * @deprecated Use anki.decks.DeckTreeRequest.$Properties instead.
         */
        interface IDeckTreeRequest extends anki.decks.DeckTreeRequest.$Properties {
        }

        /** Represents a DeckTreeRequest. */
        class DeckTreeRequest {

            /**
             * Constructs a new DeckTreeRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckTreeRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckTreeRequest now. */
            now: (number|Long);

            /**
             * Creates a new DeckTreeRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckTreeRequest instance
             */
            static create(properties: anki.decks.DeckTreeRequest.$Shape): anki.decks.DeckTreeRequest & anki.decks.DeckTreeRequest.$Shape;
            static create(properties?: anki.decks.DeckTreeRequest.$Properties): anki.decks.DeckTreeRequest;

            /**
             * Encodes the specified DeckTreeRequest message. Does not implicitly {@link anki.decks.DeckTreeRequest.verify|verify} messages.
             * @param message DeckTreeRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckTreeRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckTreeRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckTreeRequest & anki.decks.DeckTreeRequest.$Shape} DeckTreeRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckTreeRequest & anki.decks.DeckTreeRequest.$Shape;
        }

        namespace DeckTreeRequest {

            /** Properties of a DeckTreeRequest. */
            interface $Properties {

                /** DeckTreeRequest now */
                now?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckTreeRequest. */
            type $Shape = anki.decks.DeckTreeRequest.$Properties;
        }

        /**
         * Properties of a DeckTreeNode.
         * @deprecated Use anki.decks.DeckTreeNode.$Properties instead.
         */
        interface IDeckTreeNode extends anki.decks.DeckTreeNode.$Properties {
        }

        /** Represents a DeckTreeNode. */
        class DeckTreeNode {

            /**
             * Constructs a new DeckTreeNode.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckTreeNode.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckTreeNode deckId. */
            deckId: (number|Long);

            /** DeckTreeNode name. */
            name: string;

            /** DeckTreeNode level. */
            level: number;

            /** DeckTreeNode collapsed. */
            collapsed: boolean;

            /** DeckTreeNode reviewCount. */
            reviewCount: number;

            /** DeckTreeNode learnCount. */
            learnCount: number;

            /** DeckTreeNode newCount. */
            newCount: number;

            /** DeckTreeNode intradayLearning. */
            intradayLearning: number;

            /** DeckTreeNode interdayLearningUncapped. */
            interdayLearningUncapped: number;

            /** DeckTreeNode newUncapped. */
            newUncapped: number;

            /** DeckTreeNode reviewUncapped. */
            reviewUncapped: number;

            /** DeckTreeNode totalInDeck. */
            totalInDeck: number;

            /** DeckTreeNode totalIncludingChildren. */
            totalIncludingChildren: number;

            /** DeckTreeNode filtered. */
            filtered: boolean;

            /** DeckTreeNode children. */
            children: anki.decks.DeckTreeNode.$Properties[];

            /**
             * Creates a new DeckTreeNode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckTreeNode instance
             */
            static create(properties: anki.decks.DeckTreeNode.$Shape): anki.decks.DeckTreeNode & anki.decks.DeckTreeNode.$Shape;
            static create(properties?: anki.decks.DeckTreeNode.$Properties): anki.decks.DeckTreeNode;

            /**
             * Encodes the specified DeckTreeNode message. Does not implicitly {@link anki.decks.DeckTreeNode.verify|verify} messages.
             * @param message DeckTreeNode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckTreeNode.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckTreeNode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckTreeNode & anki.decks.DeckTreeNode.$Shape} DeckTreeNode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckTreeNode & anki.decks.DeckTreeNode.$Shape;
        }

        namespace DeckTreeNode {

            /** Properties of a DeckTreeNode. */
            interface $Properties {

                /** DeckTreeNode deckId */
                deckId?: (number|Long|null);

                /** DeckTreeNode name */
                name?: (string|null);

                /** DeckTreeNode level */
                level?: (number|null);

                /** DeckTreeNode collapsed */
                collapsed?: (boolean|null);

                /** DeckTreeNode reviewCount */
                reviewCount?: (number|null);

                /** DeckTreeNode learnCount */
                learnCount?: (number|null);

                /** DeckTreeNode newCount */
                newCount?: (number|null);

                /** DeckTreeNode intradayLearning */
                intradayLearning?: (number|null);

                /** DeckTreeNode interdayLearningUncapped */
                interdayLearningUncapped?: (number|null);

                /** DeckTreeNode newUncapped */
                newUncapped?: (number|null);

                /** DeckTreeNode reviewUncapped */
                reviewUncapped?: (number|null);

                /** DeckTreeNode totalInDeck */
                totalInDeck?: (number|null);

                /** DeckTreeNode totalIncludingChildren */
                totalIncludingChildren?: (number|null);

                /** DeckTreeNode filtered */
                filtered?: (boolean|null);

                /** DeckTreeNode children */
                children?: (anki.decks.DeckTreeNode.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckTreeNode. */
            type $Shape = anki.decks.DeckTreeNode.$Properties;
        }

        /**
         * Properties of a SetDeckCollapsedRequest.
         * @deprecated Use anki.decks.SetDeckCollapsedRequest.$Properties instead.
         */
        interface ISetDeckCollapsedRequest extends anki.decks.SetDeckCollapsedRequest.$Properties {
        }

        /** Represents a SetDeckCollapsedRequest. */
        class SetDeckCollapsedRequest {

            /**
             * Constructs a new SetDeckCollapsedRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.SetDeckCollapsedRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetDeckCollapsedRequest deckId. */
            deckId: (number|Long);

            /** SetDeckCollapsedRequest collapsed. */
            collapsed: boolean;

            /** SetDeckCollapsedRequest scope. */
            scope: anki.decks.SetDeckCollapsedRequest.Scope;

            /**
             * Creates a new SetDeckCollapsedRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetDeckCollapsedRequest instance
             */
            static create(properties: anki.decks.SetDeckCollapsedRequest.$Shape): anki.decks.SetDeckCollapsedRequest & anki.decks.SetDeckCollapsedRequest.$Shape;
            static create(properties?: anki.decks.SetDeckCollapsedRequest.$Properties): anki.decks.SetDeckCollapsedRequest;

            /**
             * Encodes the specified SetDeckCollapsedRequest message. Does not implicitly {@link anki.decks.SetDeckCollapsedRequest.verify|verify} messages.
             * @param message SetDeckCollapsedRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.SetDeckCollapsedRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetDeckCollapsedRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.SetDeckCollapsedRequest & anki.decks.SetDeckCollapsedRequest.$Shape} SetDeckCollapsedRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.SetDeckCollapsedRequest & anki.decks.SetDeckCollapsedRequest.$Shape;
        }

        namespace SetDeckCollapsedRequest {

            /** Properties of a SetDeckCollapsedRequest. */
            interface $Properties {

                /** SetDeckCollapsedRequest deckId */
                deckId?: (number|Long|null);

                /** SetDeckCollapsedRequest collapsed */
                collapsed?: (boolean|null);

                /** SetDeckCollapsedRequest scope */
                scope?: (anki.decks.SetDeckCollapsedRequest.Scope|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetDeckCollapsedRequest. */
            type $Shape = anki.decks.SetDeckCollapsedRequest.$Properties;

            /** Scope enum. */
            enum Scope {

                /** REVIEWER value */
                REVIEWER = 0,

                /** BROWSER value */
                BROWSER = 1
            }
        }

        /**
         * Properties of a GetDeckNamesRequest.
         * @deprecated Use anki.decks.GetDeckNamesRequest.$Properties instead.
         */
        interface IGetDeckNamesRequest extends anki.decks.GetDeckNamesRequest.$Properties {
        }

        /** Represents a GetDeckNamesRequest. */
        class GetDeckNamesRequest {

            /**
             * Constructs a new GetDeckNamesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.GetDeckNamesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GetDeckNamesRequest skipEmptyDefault. */
            skipEmptyDefault: boolean;

            /** GetDeckNamesRequest includeFiltered. */
            includeFiltered: boolean;

            /**
             * Creates a new GetDeckNamesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetDeckNamesRequest instance
             */
            static create(properties: anki.decks.GetDeckNamesRequest.$Shape): anki.decks.GetDeckNamesRequest & anki.decks.GetDeckNamesRequest.$Shape;
            static create(properties?: anki.decks.GetDeckNamesRequest.$Properties): anki.decks.GetDeckNamesRequest;

            /**
             * Encodes the specified GetDeckNamesRequest message. Does not implicitly {@link anki.decks.GetDeckNamesRequest.verify|verify} messages.
             * @param message GetDeckNamesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.GetDeckNamesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetDeckNamesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.GetDeckNamesRequest & anki.decks.GetDeckNamesRequest.$Shape} GetDeckNamesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.GetDeckNamesRequest & anki.decks.GetDeckNamesRequest.$Shape;
        }

        namespace GetDeckNamesRequest {

            /** Properties of a GetDeckNamesRequest. */
            interface $Properties {

                /** GetDeckNamesRequest skipEmptyDefault */
                skipEmptyDefault?: (boolean|null);

                /** GetDeckNamesRequest includeFiltered */
                includeFiltered?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GetDeckNamesRequest. */
            type $Shape = anki.decks.GetDeckNamesRequest.$Properties;
        }

        /**
         * Properties of a DeckNames.
         * @deprecated Use anki.decks.DeckNames.$Properties instead.
         */
        interface IDeckNames extends anki.decks.DeckNames.$Properties {
        }

        /** Represents a DeckNames. */
        class DeckNames {

            /**
             * Constructs a new DeckNames.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckNames.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckNames entries. */
            entries: anki.decks.DeckNameId.$Properties[];

            /**
             * Creates a new DeckNames instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckNames instance
             */
            static create(properties: anki.decks.DeckNames.$Shape): anki.decks.DeckNames & anki.decks.DeckNames.$Shape;
            static create(properties?: anki.decks.DeckNames.$Properties): anki.decks.DeckNames;

            /**
             * Encodes the specified DeckNames message. Does not implicitly {@link anki.decks.DeckNames.verify|verify} messages.
             * @param message DeckNames message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckNames.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckNames message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckNames & anki.decks.DeckNames.$Shape} DeckNames
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckNames & anki.decks.DeckNames.$Shape;
        }

        namespace DeckNames {

            /** Properties of a DeckNames. */
            interface $Properties {

                /** DeckNames entries */
                entries?: (anki.decks.DeckNameId.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckNames. */
            type $Shape = anki.decks.DeckNames.$Properties;
        }

        /**
         * Properties of a DeckNameId.
         * @deprecated Use anki.decks.DeckNameId.$Properties instead.
         */
        interface IDeckNameId extends anki.decks.DeckNameId.$Properties {
        }

        /** Represents a DeckNameId. */
        class DeckNameId {

            /**
             * Constructs a new DeckNameId.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.DeckNameId.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** DeckNameId id. */
            id: (number|Long);

            /** DeckNameId name. */
            name: string;

            /**
             * Creates a new DeckNameId instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeckNameId instance
             */
            static create(properties: anki.decks.DeckNameId.$Shape): anki.decks.DeckNameId & anki.decks.DeckNameId.$Shape;
            static create(properties?: anki.decks.DeckNameId.$Properties): anki.decks.DeckNameId;

            /**
             * Encodes the specified DeckNameId message. Does not implicitly {@link anki.decks.DeckNameId.verify|verify} messages.
             * @param message DeckNameId message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.DeckNameId.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeckNameId message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.DeckNameId & anki.decks.DeckNameId.$Shape} DeckNameId
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.DeckNameId & anki.decks.DeckNameId.$Shape;
        }

        namespace DeckNameId {

            /** Properties of a DeckNameId. */
            interface $Properties {

                /** DeckNameId id */
                id?: (number|Long|null);

                /** DeckNameId name */
                name?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a DeckNameId. */
            type $Shape = anki.decks.DeckNameId.$Properties;
        }

        /**
         * Properties of a ReparentDecksRequest.
         * @deprecated Use anki.decks.ReparentDecksRequest.$Properties instead.
         */
        interface IReparentDecksRequest extends anki.decks.ReparentDecksRequest.$Properties {
        }

        /** Represents a ReparentDecksRequest. */
        class ReparentDecksRequest {

            /**
             * Constructs a new ReparentDecksRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.ReparentDecksRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ReparentDecksRequest deckIds. */
            deckIds: (number|Long)[];

            /** ReparentDecksRequest newParent. */
            newParent: (number|Long);

            /**
             * Creates a new ReparentDecksRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ReparentDecksRequest instance
             */
            static create(properties: anki.decks.ReparentDecksRequest.$Shape): anki.decks.ReparentDecksRequest & anki.decks.ReparentDecksRequest.$Shape;
            static create(properties?: anki.decks.ReparentDecksRequest.$Properties): anki.decks.ReparentDecksRequest;

            /**
             * Encodes the specified ReparentDecksRequest message. Does not implicitly {@link anki.decks.ReparentDecksRequest.verify|verify} messages.
             * @param message ReparentDecksRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.ReparentDecksRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ReparentDecksRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.ReparentDecksRequest & anki.decks.ReparentDecksRequest.$Shape} ReparentDecksRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.ReparentDecksRequest & anki.decks.ReparentDecksRequest.$Shape;
        }

        namespace ReparentDecksRequest {

            /** Properties of a ReparentDecksRequest. */
            interface $Properties {

                /** ReparentDecksRequest deckIds */
                deckIds?: ((number|Long)[]|null);

                /** ReparentDecksRequest newParent */
                newParent?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ReparentDecksRequest. */
            type $Shape = anki.decks.ReparentDecksRequest.$Properties;
        }

        /**
         * Properties of a RenameDeckRequest.
         * @deprecated Use anki.decks.RenameDeckRequest.$Properties instead.
         */
        interface IRenameDeckRequest extends anki.decks.RenameDeckRequest.$Properties {
        }

        /** Represents a RenameDeckRequest. */
        class RenameDeckRequest {

            /**
             * Constructs a new RenameDeckRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.RenameDeckRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenameDeckRequest deckId. */
            deckId: (number|Long);

            /** RenameDeckRequest newName. */
            newName: string;

            /**
             * Creates a new RenameDeckRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenameDeckRequest instance
             */
            static create(properties: anki.decks.RenameDeckRequest.$Shape): anki.decks.RenameDeckRequest & anki.decks.RenameDeckRequest.$Shape;
            static create(properties?: anki.decks.RenameDeckRequest.$Properties): anki.decks.RenameDeckRequest;

            /**
             * Encodes the specified RenameDeckRequest message. Does not implicitly {@link anki.decks.RenameDeckRequest.verify|verify} messages.
             * @param message RenameDeckRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.RenameDeckRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenameDeckRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.RenameDeckRequest & anki.decks.RenameDeckRequest.$Shape} RenameDeckRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.RenameDeckRequest & anki.decks.RenameDeckRequest.$Shape;
        }

        namespace RenameDeckRequest {

            /** Properties of a RenameDeckRequest. */
            interface $Properties {

                /** RenameDeckRequest deckId */
                deckId?: (number|Long|null);

                /** RenameDeckRequest newName */
                newName?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenameDeckRequest. */
            type $Shape = anki.decks.RenameDeckRequest.$Properties;
        }

        /**
         * Properties of a FilteredDeckForUpdate.
         * @deprecated Use anki.decks.FilteredDeckForUpdate.$Properties instead.
         */
        interface IFilteredDeckForUpdate extends anki.decks.FilteredDeckForUpdate.$Properties {
        }

        /** Represents a FilteredDeckForUpdate. */
        class FilteredDeckForUpdate {

            /**
             * Constructs a new FilteredDeckForUpdate.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.decks.FilteredDeckForUpdate.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FilteredDeckForUpdate id. */
            id: (number|Long);

            /** FilteredDeckForUpdate name. */
            name: string;

            /** FilteredDeckForUpdate config. */
            config?: (anki.decks.Deck.Filtered.$Properties|null);

            /** FilteredDeckForUpdate allowEmpty. */
            allowEmpty: boolean;

            /**
             * Creates a new FilteredDeckForUpdate instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FilteredDeckForUpdate instance
             */
            static create(properties: anki.decks.FilteredDeckForUpdate.$Shape): anki.decks.FilteredDeckForUpdate & anki.decks.FilteredDeckForUpdate.$Shape;
            static create(properties?: anki.decks.FilteredDeckForUpdate.$Properties): anki.decks.FilteredDeckForUpdate;

            /**
             * Encodes the specified FilteredDeckForUpdate message. Does not implicitly {@link anki.decks.FilteredDeckForUpdate.verify|verify} messages.
             * @param message FilteredDeckForUpdate message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.decks.FilteredDeckForUpdate.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FilteredDeckForUpdate message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.decks.FilteredDeckForUpdate & anki.decks.FilteredDeckForUpdate.$Shape} FilteredDeckForUpdate
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.decks.FilteredDeckForUpdate & anki.decks.FilteredDeckForUpdate.$Shape;
        }

        namespace FilteredDeckForUpdate {

            /** Properties of a FilteredDeckForUpdate. */
            interface $Properties {

                /** FilteredDeckForUpdate id */
                id?: (number|Long|null);

                /** FilteredDeckForUpdate name */
                name?: (string|null);

                /** FilteredDeckForUpdate config */
                config?: (anki.decks.Deck.Filtered.$Properties|null);

                /** FilteredDeckForUpdate allowEmpty */
                allowEmpty?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FilteredDeckForUpdate. */
            type $Shape = anki.decks.FilteredDeckForUpdate.$Properties;
        }
    }

    /** Namespace media. */
    namespace media {

        /**
         * Properties of a CheckMediaResponse.
         * @deprecated Use anki.media.CheckMediaResponse.$Properties instead.
         */
        interface ICheckMediaResponse extends anki.media.CheckMediaResponse.$Properties {
        }

        /** Represents a CheckMediaResponse. */
        class CheckMediaResponse {

            /**
             * Constructs a new CheckMediaResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.media.CheckMediaResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CheckMediaResponse unused. */
            unused: string[];

            /** CheckMediaResponse missing. */
            missing: string[];

            /** CheckMediaResponse missingMediaNotes. */
            missingMediaNotes: (number|Long)[];

            /** CheckMediaResponse report. */
            report: string;

            /** CheckMediaResponse haveTrash. */
            haveTrash: boolean;

            /**
             * Creates a new CheckMediaResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CheckMediaResponse instance
             */
            static create(properties: anki.media.CheckMediaResponse.$Shape): anki.media.CheckMediaResponse & anki.media.CheckMediaResponse.$Shape;
            static create(properties?: anki.media.CheckMediaResponse.$Properties): anki.media.CheckMediaResponse;

            /**
             * Encodes the specified CheckMediaResponse message. Does not implicitly {@link anki.media.CheckMediaResponse.verify|verify} messages.
             * @param message CheckMediaResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.media.CheckMediaResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CheckMediaResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.media.CheckMediaResponse & anki.media.CheckMediaResponse.$Shape} CheckMediaResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.media.CheckMediaResponse & anki.media.CheckMediaResponse.$Shape;
        }

        namespace CheckMediaResponse {

            /** Properties of a CheckMediaResponse. */
            interface $Properties {

                /** CheckMediaResponse unused */
                unused?: (string[]|null);

                /** CheckMediaResponse missing */
                missing?: (string[]|null);

                /** CheckMediaResponse missingMediaNotes */
                missingMediaNotes?: ((number|Long)[]|null);

                /** CheckMediaResponse report */
                report?: (string|null);

                /** CheckMediaResponse haveTrash */
                haveTrash?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CheckMediaResponse. */
            type $Shape = anki.media.CheckMediaResponse.$Properties;
        }

        /**
         * Properties of a TrashMediaFilesRequest.
         * @deprecated Use anki.media.TrashMediaFilesRequest.$Properties instead.
         */
        interface ITrashMediaFilesRequest extends anki.media.TrashMediaFilesRequest.$Properties {
        }

        /** Represents a TrashMediaFilesRequest. */
        class TrashMediaFilesRequest {

            /**
             * Constructs a new TrashMediaFilesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.media.TrashMediaFilesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** TrashMediaFilesRequest fnames. */
            fnames: string[];

            /**
             * Creates a new TrashMediaFilesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TrashMediaFilesRequest instance
             */
            static create(properties: anki.media.TrashMediaFilesRequest.$Shape): anki.media.TrashMediaFilesRequest & anki.media.TrashMediaFilesRequest.$Shape;
            static create(properties?: anki.media.TrashMediaFilesRequest.$Properties): anki.media.TrashMediaFilesRequest;

            /**
             * Encodes the specified TrashMediaFilesRequest message. Does not implicitly {@link anki.media.TrashMediaFilesRequest.verify|verify} messages.
             * @param message TrashMediaFilesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.media.TrashMediaFilesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TrashMediaFilesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.media.TrashMediaFilesRequest & anki.media.TrashMediaFilesRequest.$Shape} TrashMediaFilesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.media.TrashMediaFilesRequest & anki.media.TrashMediaFilesRequest.$Shape;
        }

        namespace TrashMediaFilesRequest {

            /** Properties of a TrashMediaFilesRequest. */
            interface $Properties {

                /** TrashMediaFilesRequest fnames */
                fnames?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a TrashMediaFilesRequest. */
            type $Shape = anki.media.TrashMediaFilesRequest.$Properties;
        }

        /**
         * Properties of an AddMediaFileRequest.
         * @deprecated Use anki.media.AddMediaFileRequest.$Properties instead.
         */
        interface IAddMediaFileRequest extends anki.media.AddMediaFileRequest.$Properties {
        }

        /** Represents an AddMediaFileRequest. */
        class AddMediaFileRequest {

            /**
             * Constructs a new AddMediaFileRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.media.AddMediaFileRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** AddMediaFileRequest desiredName. */
            desiredName: string;

            /** AddMediaFileRequest data. */
            data: Uint8Array;

            /**
             * Creates a new AddMediaFileRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AddMediaFileRequest instance
             */
            static create(properties: anki.media.AddMediaFileRequest.$Shape): anki.media.AddMediaFileRequest & anki.media.AddMediaFileRequest.$Shape;
            static create(properties?: anki.media.AddMediaFileRequest.$Properties): anki.media.AddMediaFileRequest;

            /**
             * Encodes the specified AddMediaFileRequest message. Does not implicitly {@link anki.media.AddMediaFileRequest.verify|verify} messages.
             * @param message AddMediaFileRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.media.AddMediaFileRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an AddMediaFileRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.media.AddMediaFileRequest & anki.media.AddMediaFileRequest.$Shape} AddMediaFileRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.media.AddMediaFileRequest & anki.media.AddMediaFileRequest.$Shape;
        }

        namespace AddMediaFileRequest {

            /** Properties of an AddMediaFileRequest. */
            interface $Properties {

                /** AddMediaFileRequest desiredName */
                desiredName?: (string|null);

                /** AddMediaFileRequest data */
                data?: (Uint8Array|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an AddMediaFileRequest. */
            type $Shape = anki.media.AddMediaFileRequest.$Properties;
        }
    }

    /** Namespace scheduler. */
    namespace scheduler {

        /**
         * Properties of a SchedulingState.
         * @deprecated Use anki.scheduler.SchedulingState.$Properties instead.
         */
        interface ISchedulingState extends anki.scheduler.SchedulingState.$Properties {
        }

        /** Represents a SchedulingState. */
        class SchedulingState {

            /**
             * Constructs a new SchedulingState.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SchedulingState.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SchedulingState customData. */
            customData?: (string|null);

            /** SchedulingState normal. */
            normal?: (anki.scheduler.SchedulingState.Normal.$Properties|null);

            /** SchedulingState filtered. */
            filtered?: (anki.scheduler.SchedulingState.Filtered.$Properties|null);

            /** SchedulingState kind. */
            kind?: ("normal"|"filtered");

            /**
             * Creates a new SchedulingState instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SchedulingState instance
             */
            static create(properties: anki.scheduler.SchedulingState.$Shape): anki.scheduler.SchedulingState & anki.scheduler.SchedulingState.$Shape;
            static create(properties?: anki.scheduler.SchedulingState.$Properties): anki.scheduler.SchedulingState;

            /**
             * Encodes the specified SchedulingState message. Does not implicitly {@link anki.scheduler.SchedulingState.verify|verify} messages.
             * @param message SchedulingState message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SchedulingState.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SchedulingState message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SchedulingState & anki.scheduler.SchedulingState.$Shape} SchedulingState
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState & anki.scheduler.SchedulingState.$Shape;
        }

        namespace SchedulingState {

            /** Properties of a SchedulingState. */
            interface $Properties {

                /** SchedulingState customData */
                customData?: (string|null);

                /** SchedulingState normal */
                normal?: (anki.scheduler.SchedulingState.Normal.$Properties|null);

                /** SchedulingState filtered */
                filtered?: (anki.scheduler.SchedulingState.Filtered.$Properties|null);

                /** SchedulingState kind */
                kind?: ("normal"|"filtered");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a SchedulingState. */
            type $Shape = {
              customData?: string|null;
              normal?: anki.scheduler.SchedulingState.Normal.$Shape|null;
              filtered?: anki.scheduler.SchedulingState.Filtered.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ kind?: undefined; normal?: null; filtered?: null }|{ kind?: "normal"; normal: anki.scheduler.SchedulingState.Normal.$Shape; filtered?: null }|{ kind?: "filtered"; normal?: null; filtered: anki.scheduler.SchedulingState.Filtered.$Shape })
            );

            /**
             * Properties of a New.
             * @deprecated Use anki.scheduler.SchedulingState.New.$Properties instead.
             */
            interface INew extends anki.scheduler.SchedulingState.New.$Properties {
            }

            /** Represents a New. */
            class New {

                /**
                 * Constructs a new New.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.New.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** New position. */
                position: number;

                /**
                 * Creates a new New instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns New instance
                 */
                static create(properties: anki.scheduler.SchedulingState.New.$Shape): anki.scheduler.SchedulingState.New & anki.scheduler.SchedulingState.New.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.New.$Properties): anki.scheduler.SchedulingState.New;

                /**
                 * Encodes the specified New message. Does not implicitly {@link anki.scheduler.SchedulingState.New.verify|verify} messages.
                 * @param message New message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.New.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a New message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.New & anki.scheduler.SchedulingState.New.$Shape} New
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.New & anki.scheduler.SchedulingState.New.$Shape;
            }

            namespace New {

                /** Properties of a New. */
                interface $Properties {

                    /** New position */
                    position?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a New. */
                type $Shape = anki.scheduler.SchedulingState.New.$Properties;
            }

            /**
             * Properties of a Learning.
             * @deprecated Use anki.scheduler.SchedulingState.Learning.$Properties instead.
             */
            interface ILearning extends anki.scheduler.SchedulingState.Learning.$Properties {
            }

            /** Represents a Learning. */
            class Learning {

                /**
                 * Constructs a new Learning.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Learning.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Learning remainingSteps. */
                remainingSteps: number;

                /** Learning scheduledSecs. */
                scheduledSecs: number;

                /** Learning elapsedSecs. */
                elapsedSecs: number;

                /** Learning memoryState. */
                memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                /**
                 * Creates a new Learning instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Learning instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Learning.$Shape): anki.scheduler.SchedulingState.Learning & anki.scheduler.SchedulingState.Learning.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Learning.$Properties): anki.scheduler.SchedulingState.Learning;

                /**
                 * Encodes the specified Learning message. Does not implicitly {@link anki.scheduler.SchedulingState.Learning.verify|verify} messages.
                 * @param message Learning message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Learning.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Learning message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Learning & anki.scheduler.SchedulingState.Learning.$Shape} Learning
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Learning & anki.scheduler.SchedulingState.Learning.$Shape;
            }

            namespace Learning {

                /** Properties of a Learning. */
                interface $Properties {

                    /** Learning remainingSteps */
                    remainingSteps?: (number|null);

                    /** Learning scheduledSecs */
                    scheduledSecs?: (number|null);

                    /** Learning elapsedSecs */
                    elapsedSecs?: (number|null);

                    /** Learning memoryState */
                    memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Learning. */
                type $Shape = anki.scheduler.SchedulingState.Learning.$Properties;
            }

            /**
             * Properties of a Review.
             * @deprecated Use anki.scheduler.SchedulingState.Review.$Properties instead.
             */
            interface IReview extends anki.scheduler.SchedulingState.Review.$Properties {
            }

            /** Represents a Review. */
            class Review {

                /**
                 * Constructs a new Review.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Review.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Review scheduledDays. */
                scheduledDays: number;

                /** Review elapsedDays. */
                elapsedDays: number;

                /** Review easeFactor. */
                easeFactor: number;

                /** Review lapses. */
                lapses: number;

                /** Review leeched. */
                leeched: boolean;

                /** Review memoryState. */
                memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                /**
                 * Creates a new Review instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Review instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Review.$Shape): anki.scheduler.SchedulingState.Review & anki.scheduler.SchedulingState.Review.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Review.$Properties): anki.scheduler.SchedulingState.Review;

                /**
                 * Encodes the specified Review message. Does not implicitly {@link anki.scheduler.SchedulingState.Review.verify|verify} messages.
                 * @param message Review message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Review.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Review message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Review & anki.scheduler.SchedulingState.Review.$Shape} Review
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Review & anki.scheduler.SchedulingState.Review.$Shape;
            }

            namespace Review {

                /** Properties of a Review. */
                interface $Properties {

                    /** Review scheduledDays */
                    scheduledDays?: (number|null);

                    /** Review elapsedDays */
                    elapsedDays?: (number|null);

                    /** Review easeFactor */
                    easeFactor?: (number|null);

                    /** Review lapses */
                    lapses?: (number|null);

                    /** Review leeched */
                    leeched?: (boolean|null);

                    /** Review memoryState */
                    memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Review. */
                type $Shape = anki.scheduler.SchedulingState.Review.$Properties;
            }

            /**
             * Properties of a Relearning.
             * @deprecated Use anki.scheduler.SchedulingState.Relearning.$Properties instead.
             */
            interface IRelearning extends anki.scheduler.SchedulingState.Relearning.$Properties {
            }

            /** Represents a Relearning. */
            class Relearning {

                /**
                 * Constructs a new Relearning.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Relearning.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Relearning review. */
                review?: (anki.scheduler.SchedulingState.Review.$Properties|null);

                /** Relearning learning. */
                learning?: (anki.scheduler.SchedulingState.Learning.$Properties|null);

                /**
                 * Creates a new Relearning instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Relearning instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Relearning.$Shape): anki.scheduler.SchedulingState.Relearning & anki.scheduler.SchedulingState.Relearning.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Relearning.$Properties): anki.scheduler.SchedulingState.Relearning;

                /**
                 * Encodes the specified Relearning message. Does not implicitly {@link anki.scheduler.SchedulingState.Relearning.verify|verify} messages.
                 * @param message Relearning message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Relearning.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Relearning message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Relearning & anki.scheduler.SchedulingState.Relearning.$Shape} Relearning
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Relearning & anki.scheduler.SchedulingState.Relearning.$Shape;
            }

            namespace Relearning {

                /** Properties of a Relearning. */
                interface $Properties {

                    /** Relearning review */
                    review?: (anki.scheduler.SchedulingState.Review.$Properties|null);

                    /** Relearning learning */
                    learning?: (anki.scheduler.SchedulingState.Learning.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Relearning. */
                type $Shape = anki.scheduler.SchedulingState.Relearning.$Properties;
            }

            /**
             * Properties of a Normal.
             * @deprecated Use anki.scheduler.SchedulingState.Normal.$Properties instead.
             */
            interface INormal extends anki.scheduler.SchedulingState.Normal.$Properties {
            }

            /** Represents a Normal. */
            class Normal {

                /**
                 * Constructs a new Normal.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Normal.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Normal new. */
                new?: (anki.scheduler.SchedulingState.New.$Properties|null);

                /** Normal learning. */
                learning?: (anki.scheduler.SchedulingState.Learning.$Properties|null);

                /** Normal review. */
                review?: (anki.scheduler.SchedulingState.Review.$Properties|null);

                /** Normal relearning. */
                relearning?: (anki.scheduler.SchedulingState.Relearning.$Properties|null);

                /** Normal kind. */
                kind?: ("new"|"learning"|"review"|"relearning");

                /**
                 * Creates a new Normal instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Normal instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Normal.$Shape): anki.scheduler.SchedulingState.Normal & anki.scheduler.SchedulingState.Normal.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Normal.$Properties): anki.scheduler.SchedulingState.Normal;

                /**
                 * Encodes the specified Normal message. Does not implicitly {@link anki.scheduler.SchedulingState.Normal.verify|verify} messages.
                 * @param message Normal message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Normal.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Normal message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Normal & anki.scheduler.SchedulingState.Normal.$Shape} Normal
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Normal & anki.scheduler.SchedulingState.Normal.$Shape;
            }

            namespace Normal {

                /** Properties of a Normal. */
                interface $Properties {

                    /** Normal new */
                    "new"?: (anki.scheduler.SchedulingState.New.$Properties|null);

                    /** Normal learning */
                    learning?: (anki.scheduler.SchedulingState.Learning.$Properties|null);

                    /** Normal review */
                    review?: (anki.scheduler.SchedulingState.Review.$Properties|null);

                    /** Normal relearning */
                    relearning?: (anki.scheduler.SchedulingState.Relearning.$Properties|null);

                    /** Normal kind */
                    kind?: ("new"|"learning"|"review"|"relearning");

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Narrowed shape of a Normal. */
                type $Shape = {
                  "new"?: anki.scheduler.SchedulingState.New.$Shape|null;
                  learning?: anki.scheduler.SchedulingState.Learning.$Shape|null;
                  review?: anki.scheduler.SchedulingState.Review.$Shape|null;
                  relearning?: anki.scheduler.SchedulingState.Relearning.$Shape|null;
                  $unknowns?: Uint8Array[];
                } & (
                  ({ kind?: undefined; "new"?: null; learning?: null; review?: null; relearning?: null }|{ kind?: "new"; "new": anki.scheduler.SchedulingState.New.$Shape; learning?: null; review?: null; relearning?: null }|{ kind?: "learning"; "new"?: null; learning: anki.scheduler.SchedulingState.Learning.$Shape; review?: null; relearning?: null }|{ kind?: "review"; "new"?: null; learning?: null; review: anki.scheduler.SchedulingState.Review.$Shape; relearning?: null }|{ kind?: "relearning"; "new"?: null; learning?: null; review?: null; relearning: anki.scheduler.SchedulingState.Relearning.$Shape })
                );
            }

            /**
             * Properties of a Preview.
             * @deprecated Use anki.scheduler.SchedulingState.Preview.$Properties instead.
             */
            interface IPreview extends anki.scheduler.SchedulingState.Preview.$Properties {
            }

            /** Represents a Preview. */
            class Preview {

                /**
                 * Constructs a new Preview.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Preview.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Preview scheduledSecs. */
                scheduledSecs: number;

                /** Preview finished. */
                finished: boolean;

                /**
                 * Creates a new Preview instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Preview instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Preview.$Shape): anki.scheduler.SchedulingState.Preview & anki.scheduler.SchedulingState.Preview.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Preview.$Properties): anki.scheduler.SchedulingState.Preview;

                /**
                 * Encodes the specified Preview message. Does not implicitly {@link anki.scheduler.SchedulingState.Preview.verify|verify} messages.
                 * @param message Preview message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Preview.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Preview message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Preview & anki.scheduler.SchedulingState.Preview.$Shape} Preview
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Preview & anki.scheduler.SchedulingState.Preview.$Shape;
            }

            namespace Preview {

                /** Properties of a Preview. */
                interface $Properties {

                    /** Preview scheduledSecs */
                    scheduledSecs?: (number|null);

                    /** Preview finished */
                    finished?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Preview. */
                type $Shape = anki.scheduler.SchedulingState.Preview.$Properties;
            }

            /**
             * Properties of a ReschedulingFilter.
             * @deprecated Use anki.scheduler.SchedulingState.ReschedulingFilter.$Properties instead.
             */
            interface IReschedulingFilter extends anki.scheduler.SchedulingState.ReschedulingFilter.$Properties {
            }

            /** Represents a ReschedulingFilter. */
            class ReschedulingFilter {

                /**
                 * Constructs a new ReschedulingFilter.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.ReschedulingFilter.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** ReschedulingFilter originalState. */
                originalState?: (anki.scheduler.SchedulingState.Normal.$Properties|null);

                /**
                 * Creates a new ReschedulingFilter instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ReschedulingFilter instance
                 */
                static create(properties: anki.scheduler.SchedulingState.ReschedulingFilter.$Shape): anki.scheduler.SchedulingState.ReschedulingFilter & anki.scheduler.SchedulingState.ReschedulingFilter.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.ReschedulingFilter.$Properties): anki.scheduler.SchedulingState.ReschedulingFilter;

                /**
                 * Encodes the specified ReschedulingFilter message. Does not implicitly {@link anki.scheduler.SchedulingState.ReschedulingFilter.verify|verify} messages.
                 * @param message ReschedulingFilter message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.ReschedulingFilter.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a ReschedulingFilter message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.ReschedulingFilter & anki.scheduler.SchedulingState.ReschedulingFilter.$Shape} ReschedulingFilter
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.ReschedulingFilter & anki.scheduler.SchedulingState.ReschedulingFilter.$Shape;
            }

            namespace ReschedulingFilter {

                /** Properties of a ReschedulingFilter. */
                interface $Properties {

                    /** ReschedulingFilter originalState */
                    originalState?: (anki.scheduler.SchedulingState.Normal.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a ReschedulingFilter. */
                type $Shape = {
                  originalState?: anki.scheduler.SchedulingState.Normal.$Shape|null;
                  $unknowns?: Uint8Array[];
                };
            }

            /**
             * Properties of a Filtered.
             * @deprecated Use anki.scheduler.SchedulingState.Filtered.$Properties instead.
             */
            interface IFiltered extends anki.scheduler.SchedulingState.Filtered.$Properties {
            }

            /** Represents a Filtered. */
            class Filtered {

                /**
                 * Constructs a new Filtered.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.SchedulingState.Filtered.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Filtered preview. */
                preview?: (anki.scheduler.SchedulingState.Preview.$Properties|null);

                /** Filtered rescheduling. */
                rescheduling?: (anki.scheduler.SchedulingState.ReschedulingFilter.$Properties|null);

                /** Filtered kind. */
                kind?: ("preview"|"rescheduling");

                /**
                 * Creates a new Filtered instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Filtered instance
                 */
                static create(properties: anki.scheduler.SchedulingState.Filtered.$Shape): anki.scheduler.SchedulingState.Filtered & anki.scheduler.SchedulingState.Filtered.$Shape;
                static create(properties?: anki.scheduler.SchedulingState.Filtered.$Properties): anki.scheduler.SchedulingState.Filtered;

                /**
                 * Encodes the specified Filtered message. Does not implicitly {@link anki.scheduler.SchedulingState.Filtered.verify|verify} messages.
                 * @param message Filtered message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.SchedulingState.Filtered.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Filtered message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.SchedulingState.Filtered & anki.scheduler.SchedulingState.Filtered.$Shape} Filtered
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingState.Filtered & anki.scheduler.SchedulingState.Filtered.$Shape;
            }

            namespace Filtered {

                /** Properties of a Filtered. */
                interface $Properties {

                    /** Filtered preview */
                    preview?: (anki.scheduler.SchedulingState.Preview.$Properties|null);

                    /** Filtered rescheduling */
                    rescheduling?: (anki.scheduler.SchedulingState.ReschedulingFilter.$Properties|null);

                    /** Filtered kind */
                    kind?: ("preview"|"rescheduling");

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Narrowed shape of a Filtered. */
                type $Shape = {
                  preview?: anki.scheduler.SchedulingState.Preview.$Shape|null;
                  rescheduling?: anki.scheduler.SchedulingState.ReschedulingFilter.$Shape|null;
                  $unknowns?: Uint8Array[];
                } & (
                  ({ kind?: undefined; preview?: null; rescheduling?: null }|{ kind?: "preview"; preview: anki.scheduler.SchedulingState.Preview.$Shape; rescheduling?: null }|{ kind?: "rescheduling"; preview?: null; rescheduling: anki.scheduler.SchedulingState.ReschedulingFilter.$Shape })
                );
            }
        }

        /**
         * Properties of a QueuedCards.
         * @deprecated Use anki.scheduler.QueuedCards.$Properties instead.
         */
        interface IQueuedCards extends anki.scheduler.QueuedCards.$Properties {
        }

        /** Represents a QueuedCards. */
        class QueuedCards {

            /**
             * Constructs a new QueuedCards.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.QueuedCards.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** QueuedCards cards. */
            cards: anki.scheduler.QueuedCards.QueuedCard.$Properties[];

            /** QueuedCards newCount. */
            newCount: number;

            /** QueuedCards learningCount. */
            learningCount: number;

            /** QueuedCards reviewCount. */
            reviewCount: number;

            /**
             * Creates a new QueuedCards instance using the specified properties.
             * @param [properties] Properties to set
             * @returns QueuedCards instance
             */
            static create(properties: anki.scheduler.QueuedCards.$Shape): anki.scheduler.QueuedCards & anki.scheduler.QueuedCards.$Shape;
            static create(properties?: anki.scheduler.QueuedCards.$Properties): anki.scheduler.QueuedCards;

            /**
             * Encodes the specified QueuedCards message. Does not implicitly {@link anki.scheduler.QueuedCards.verify|verify} messages.
             * @param message QueuedCards message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.QueuedCards.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a QueuedCards message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.QueuedCards & anki.scheduler.QueuedCards.$Shape} QueuedCards
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.QueuedCards & anki.scheduler.QueuedCards.$Shape;
        }

        namespace QueuedCards {

            /** Properties of a QueuedCards. */
            interface $Properties {

                /** QueuedCards cards */
                cards?: (anki.scheduler.QueuedCards.QueuedCard.$Properties[]|null);

                /** QueuedCards newCount */
                newCount?: (number|null);

                /** QueuedCards learningCount */
                learningCount?: (number|null);

                /** QueuedCards reviewCount */
                reviewCount?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a QueuedCards. */
            type $Shape = {
              cards?: anki.scheduler.QueuedCards.QueuedCard.$Shape[]|null;
              newCount?: number|null;
              learningCount?: number|null;
              reviewCount?: number|null;
              $unknowns?: Uint8Array[];
            };

            /** Queue enum. */
            enum Queue {

                /** NEW value */
                NEW = 0,

                /** LEARNING value */
                LEARNING = 1,

                /** REVIEW value */
                REVIEW = 2
            }

            /**
             * Properties of a QueuedCard.
             * @deprecated Use anki.scheduler.QueuedCards.QueuedCard.$Properties instead.
             */
            interface IQueuedCard extends anki.scheduler.QueuedCards.QueuedCard.$Properties {
            }

            /** Represents a QueuedCard. */
            class QueuedCard {

                /**
                 * Constructs a new QueuedCard.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.QueuedCards.QueuedCard.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** QueuedCard card. */
                card?: (anki.cards.Card.$Properties|null);

                /** QueuedCard queue. */
                queue: anki.scheduler.QueuedCards.Queue;

                /** QueuedCard states. */
                states?: (anki.scheduler.SchedulingStates.$Properties|null);

                /** QueuedCard context. */
                context?: (anki.scheduler.SchedulingContext.$Properties|null);

                /**
                 * Creates a new QueuedCard instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns QueuedCard instance
                 */
                static create(properties: anki.scheduler.QueuedCards.QueuedCard.$Shape): anki.scheduler.QueuedCards.QueuedCard & anki.scheduler.QueuedCards.QueuedCard.$Shape;
                static create(properties?: anki.scheduler.QueuedCards.QueuedCard.$Properties): anki.scheduler.QueuedCards.QueuedCard;

                /**
                 * Encodes the specified QueuedCard message. Does not implicitly {@link anki.scheduler.QueuedCards.QueuedCard.verify|verify} messages.
                 * @param message QueuedCard message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.QueuedCards.QueuedCard.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a QueuedCard message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.QueuedCards.QueuedCard & anki.scheduler.QueuedCards.QueuedCard.$Shape} QueuedCard
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.QueuedCards.QueuedCard & anki.scheduler.QueuedCards.QueuedCard.$Shape;
            }

            namespace QueuedCard {

                /** Properties of a QueuedCard. */
                interface $Properties {

                    /** QueuedCard card */
                    card?: (anki.cards.Card.$Properties|null);

                    /** QueuedCard queue */
                    queue?: (anki.scheduler.QueuedCards.Queue|null);

                    /** QueuedCard states */
                    states?: (anki.scheduler.SchedulingStates.$Properties|null);

                    /** QueuedCard context */
                    context?: (anki.scheduler.SchedulingContext.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a QueuedCard. */
                type $Shape = {
                  card?: anki.cards.Card.$Shape|null;
                  queue?: anki.scheduler.QueuedCards.Queue|null;
                  states?: anki.scheduler.SchedulingStates.$Shape|null;
                  context?: anki.scheduler.SchedulingContext.$Shape|null;
                  $unknowns?: Uint8Array[];
                };
            }
        }

        /**
         * Properties of a GetQueuedCardsRequest.
         * @deprecated Use anki.scheduler.GetQueuedCardsRequest.$Properties instead.
         */
        interface IGetQueuedCardsRequest extends anki.scheduler.GetQueuedCardsRequest.$Properties {
        }

        /** Represents a GetQueuedCardsRequest. */
        class GetQueuedCardsRequest {

            /**
             * Constructs a new GetQueuedCardsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.GetQueuedCardsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GetQueuedCardsRequest fetchLimit. */
            fetchLimit: number;

            /** GetQueuedCardsRequest intradayLearningOnly. */
            intradayLearningOnly: boolean;

            /**
             * Creates a new GetQueuedCardsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetQueuedCardsRequest instance
             */
            static create(properties: anki.scheduler.GetQueuedCardsRequest.$Shape): anki.scheduler.GetQueuedCardsRequest & anki.scheduler.GetQueuedCardsRequest.$Shape;
            static create(properties?: anki.scheduler.GetQueuedCardsRequest.$Properties): anki.scheduler.GetQueuedCardsRequest;

            /**
             * Encodes the specified GetQueuedCardsRequest message. Does not implicitly {@link anki.scheduler.GetQueuedCardsRequest.verify|verify} messages.
             * @param message GetQueuedCardsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.GetQueuedCardsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetQueuedCardsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.GetQueuedCardsRequest & anki.scheduler.GetQueuedCardsRequest.$Shape} GetQueuedCardsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.GetQueuedCardsRequest & anki.scheduler.GetQueuedCardsRequest.$Shape;
        }

        namespace GetQueuedCardsRequest {

            /** Properties of a GetQueuedCardsRequest. */
            interface $Properties {

                /** GetQueuedCardsRequest fetchLimit */
                fetchLimit?: (number|null);

                /** GetQueuedCardsRequest intradayLearningOnly */
                intradayLearningOnly?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GetQueuedCardsRequest. */
            type $Shape = anki.scheduler.GetQueuedCardsRequest.$Properties;
        }

        /**
         * Properties of a CountsForDeckTodayResponse.
         * @deprecated Use anki.scheduler.CountsForDeckTodayResponse.$Properties instead.
         */
        interface ICountsForDeckTodayResponse extends anki.scheduler.CountsForDeckTodayResponse.$Properties {
        }

        /** Represents a CountsForDeckTodayResponse. */
        class CountsForDeckTodayResponse {

            /**
             * Constructs a new CountsForDeckTodayResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CountsForDeckTodayResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CountsForDeckTodayResponse new. */
            new: number;

            /** CountsForDeckTodayResponse review. */
            review: number;

            /**
             * Creates a new CountsForDeckTodayResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CountsForDeckTodayResponse instance
             */
            static create(properties: anki.scheduler.CountsForDeckTodayResponse.$Shape): anki.scheduler.CountsForDeckTodayResponse & anki.scheduler.CountsForDeckTodayResponse.$Shape;
            static create(properties?: anki.scheduler.CountsForDeckTodayResponse.$Properties): anki.scheduler.CountsForDeckTodayResponse;

            /**
             * Encodes the specified CountsForDeckTodayResponse message. Does not implicitly {@link anki.scheduler.CountsForDeckTodayResponse.verify|verify} messages.
             * @param message CountsForDeckTodayResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CountsForDeckTodayResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CountsForDeckTodayResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CountsForDeckTodayResponse & anki.scheduler.CountsForDeckTodayResponse.$Shape} CountsForDeckTodayResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CountsForDeckTodayResponse & anki.scheduler.CountsForDeckTodayResponse.$Shape;
        }

        namespace CountsForDeckTodayResponse {

            /** Properties of a CountsForDeckTodayResponse. */
            interface $Properties {

                /** CountsForDeckTodayResponse new */
                "new"?: (number|null);

                /** CountsForDeckTodayResponse review */
                review?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CountsForDeckTodayResponse. */
            type $Shape = anki.scheduler.CountsForDeckTodayResponse.$Properties;
        }

        /**
         * Properties of a CongratsInfoResponse.
         * @deprecated Use anki.scheduler.CongratsInfoResponse.$Properties instead.
         */
        interface ICongratsInfoResponse extends anki.scheduler.CongratsInfoResponse.$Properties {
        }

        /** Represents a CongratsInfoResponse. */
        class CongratsInfoResponse {

            /**
             * Constructs a new CongratsInfoResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CongratsInfoResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CongratsInfoResponse learnRemaining. */
            learnRemaining: number;

            /** CongratsInfoResponse secsUntilNextLearn. */
            secsUntilNextLearn: number;

            /** CongratsInfoResponse reviewRemaining. */
            reviewRemaining: boolean;

            /** CongratsInfoResponse newRemaining. */
            newRemaining: boolean;

            /** CongratsInfoResponse haveSchedBuried. */
            haveSchedBuried: boolean;

            /** CongratsInfoResponse haveUserBuried. */
            haveUserBuried: boolean;

            /** CongratsInfoResponse isFilteredDeck. */
            isFilteredDeck: boolean;

            /** CongratsInfoResponse bridgeCommandsSupported. */
            bridgeCommandsSupported: boolean;

            /** CongratsInfoResponse deckDescription. */
            deckDescription: string;

            /**
             * Creates a new CongratsInfoResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CongratsInfoResponse instance
             */
            static create(properties: anki.scheduler.CongratsInfoResponse.$Shape): anki.scheduler.CongratsInfoResponse & anki.scheduler.CongratsInfoResponse.$Shape;
            static create(properties?: anki.scheduler.CongratsInfoResponse.$Properties): anki.scheduler.CongratsInfoResponse;

            /**
             * Encodes the specified CongratsInfoResponse message. Does not implicitly {@link anki.scheduler.CongratsInfoResponse.verify|verify} messages.
             * @param message CongratsInfoResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CongratsInfoResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CongratsInfoResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CongratsInfoResponse & anki.scheduler.CongratsInfoResponse.$Shape} CongratsInfoResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CongratsInfoResponse & anki.scheduler.CongratsInfoResponse.$Shape;
        }

        namespace CongratsInfoResponse {

            /** Properties of a CongratsInfoResponse. */
            interface $Properties {

                /** CongratsInfoResponse learnRemaining */
                learnRemaining?: (number|null);

                /** CongratsInfoResponse secsUntilNextLearn */
                secsUntilNextLearn?: (number|null);

                /** CongratsInfoResponse reviewRemaining */
                reviewRemaining?: (boolean|null);

                /** CongratsInfoResponse newRemaining */
                newRemaining?: (boolean|null);

                /** CongratsInfoResponse haveSchedBuried */
                haveSchedBuried?: (boolean|null);

                /** CongratsInfoResponse haveUserBuried */
                haveUserBuried?: (boolean|null);

                /** CongratsInfoResponse isFilteredDeck */
                isFilteredDeck?: (boolean|null);

                /** CongratsInfoResponse bridgeCommandsSupported */
                bridgeCommandsSupported?: (boolean|null);

                /** CongratsInfoResponse deckDescription */
                deckDescription?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CongratsInfoResponse. */
            type $Shape = anki.scheduler.CongratsInfoResponse.$Properties;
        }

        /**
         * Properties of an UnburyDeckRequest.
         * @deprecated Use anki.scheduler.UnburyDeckRequest.$Properties instead.
         */
        interface IUnburyDeckRequest extends anki.scheduler.UnburyDeckRequest.$Properties {
        }

        /** Represents an UnburyDeckRequest. */
        class UnburyDeckRequest {

            /**
             * Constructs a new UnburyDeckRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.UnburyDeckRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** UnburyDeckRequest deckId. */
            deckId: (number|Long);

            /** UnburyDeckRequest mode. */
            mode: anki.scheduler.UnburyDeckRequest.Mode;

            /**
             * Creates a new UnburyDeckRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UnburyDeckRequest instance
             */
            static create(properties: anki.scheduler.UnburyDeckRequest.$Shape): anki.scheduler.UnburyDeckRequest & anki.scheduler.UnburyDeckRequest.$Shape;
            static create(properties?: anki.scheduler.UnburyDeckRequest.$Properties): anki.scheduler.UnburyDeckRequest;

            /**
             * Encodes the specified UnburyDeckRequest message. Does not implicitly {@link anki.scheduler.UnburyDeckRequest.verify|verify} messages.
             * @param message UnburyDeckRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.UnburyDeckRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UnburyDeckRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.UnburyDeckRequest & anki.scheduler.UnburyDeckRequest.$Shape} UnburyDeckRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.UnburyDeckRequest & anki.scheduler.UnburyDeckRequest.$Shape;
        }

        namespace UnburyDeckRequest {

            /** Properties of an UnburyDeckRequest. */
            interface $Properties {

                /** UnburyDeckRequest deckId */
                deckId?: (number|Long|null);

                /** UnburyDeckRequest mode */
                mode?: (anki.scheduler.UnburyDeckRequest.Mode|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of an UnburyDeckRequest. */
            type $Shape = anki.scheduler.UnburyDeckRequest.$Properties;

            /** Mode enum. */
            enum Mode {

                /** ALL value */
                ALL = 0,

                /** SCHED_ONLY value */
                SCHED_ONLY = 1,

                /** USER_ONLY value */
                USER_ONLY = 2
            }
        }

        /**
         * Properties of a BuryOrSuspendCardsRequest.
         * @deprecated Use anki.scheduler.BuryOrSuspendCardsRequest.$Properties instead.
         */
        interface IBuryOrSuspendCardsRequest extends anki.scheduler.BuryOrSuspendCardsRequest.$Properties {
        }

        /** Represents a BuryOrSuspendCardsRequest. */
        class BuryOrSuspendCardsRequest {

            /**
             * Constructs a new BuryOrSuspendCardsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.BuryOrSuspendCardsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** BuryOrSuspendCardsRequest cardIds. */
            cardIds: (number|Long)[];

            /** BuryOrSuspendCardsRequest noteIds. */
            noteIds: (number|Long)[];

            /** BuryOrSuspendCardsRequest mode. */
            mode: anki.scheduler.BuryOrSuspendCardsRequest.Mode;

            /**
             * Creates a new BuryOrSuspendCardsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns BuryOrSuspendCardsRequest instance
             */
            static create(properties: anki.scheduler.BuryOrSuspendCardsRequest.$Shape): anki.scheduler.BuryOrSuspendCardsRequest & anki.scheduler.BuryOrSuspendCardsRequest.$Shape;
            static create(properties?: anki.scheduler.BuryOrSuspendCardsRequest.$Properties): anki.scheduler.BuryOrSuspendCardsRequest;

            /**
             * Encodes the specified BuryOrSuspendCardsRequest message. Does not implicitly {@link anki.scheduler.BuryOrSuspendCardsRequest.verify|verify} messages.
             * @param message BuryOrSuspendCardsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.BuryOrSuspendCardsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a BuryOrSuspendCardsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.BuryOrSuspendCardsRequest & anki.scheduler.BuryOrSuspendCardsRequest.$Shape} BuryOrSuspendCardsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.BuryOrSuspendCardsRequest & anki.scheduler.BuryOrSuspendCardsRequest.$Shape;
        }

        namespace BuryOrSuspendCardsRequest {

            /** Properties of a BuryOrSuspendCardsRequest. */
            interface $Properties {

                /** BuryOrSuspendCardsRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** BuryOrSuspendCardsRequest noteIds */
                noteIds?: ((number|Long)[]|null);

                /** BuryOrSuspendCardsRequest mode */
                mode?: (anki.scheduler.BuryOrSuspendCardsRequest.Mode|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a BuryOrSuspendCardsRequest. */
            type $Shape = anki.scheduler.BuryOrSuspendCardsRequest.$Properties;

            /** Mode enum. */
            enum Mode {

                /** SUSPEND value */
                SUSPEND = 0,

                /** BURY_SCHED value */
                BURY_SCHED = 1,

                /** BURY_USER value */
                BURY_USER = 2
            }
        }

        /**
         * Properties of a ScheduleCardsAsNewRequest.
         * @deprecated Use anki.scheduler.ScheduleCardsAsNewRequest.$Properties instead.
         */
        interface IScheduleCardsAsNewRequest extends anki.scheduler.ScheduleCardsAsNewRequest.$Properties {
        }

        /** Represents a ScheduleCardsAsNewRequest. */
        class ScheduleCardsAsNewRequest {

            /**
             * Constructs a new ScheduleCardsAsNewRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ScheduleCardsAsNewRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ScheduleCardsAsNewRequest cardIds. */
            cardIds: (number|Long)[];

            /** ScheduleCardsAsNewRequest log. */
            log: boolean;

            /** ScheduleCardsAsNewRequest restorePosition. */
            restorePosition: boolean;

            /** ScheduleCardsAsNewRequest resetCounts. */
            resetCounts: boolean;

            /** ScheduleCardsAsNewRequest context. */
            context?: (anki.scheduler.ScheduleCardsAsNewRequest.Context|null);

            /**
             * Creates a new ScheduleCardsAsNewRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ScheduleCardsAsNewRequest instance
             */
            static create(properties: anki.scheduler.ScheduleCardsAsNewRequest.$Shape): anki.scheduler.ScheduleCardsAsNewRequest & anki.scheduler.ScheduleCardsAsNewRequest.$Shape;
            static create(properties?: anki.scheduler.ScheduleCardsAsNewRequest.$Properties): anki.scheduler.ScheduleCardsAsNewRequest;

            /**
             * Encodes the specified ScheduleCardsAsNewRequest message. Does not implicitly {@link anki.scheduler.ScheduleCardsAsNewRequest.verify|verify} messages.
             * @param message ScheduleCardsAsNewRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ScheduleCardsAsNewRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ScheduleCardsAsNewRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ScheduleCardsAsNewRequest & anki.scheduler.ScheduleCardsAsNewRequest.$Shape} ScheduleCardsAsNewRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ScheduleCardsAsNewRequest & anki.scheduler.ScheduleCardsAsNewRequest.$Shape;
        }

        namespace ScheduleCardsAsNewRequest {

            /** Properties of a ScheduleCardsAsNewRequest. */
            interface $Properties {

                /** ScheduleCardsAsNewRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** ScheduleCardsAsNewRequest log */
                log?: (boolean|null);

                /** ScheduleCardsAsNewRequest restorePosition */
                restorePosition?: (boolean|null);

                /** ScheduleCardsAsNewRequest resetCounts */
                resetCounts?: (boolean|null);

                /** ScheduleCardsAsNewRequest context */
                context?: (anki.scheduler.ScheduleCardsAsNewRequest.Context|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ScheduleCardsAsNewRequest. */
            type $Shape = anki.scheduler.ScheduleCardsAsNewRequest.$Properties;

            /** Context enum. */
            enum Context {

                /** BROWSER value */
                BROWSER = 0,

                /** REVIEWER value */
                REVIEWER = 1
            }
        }

        /**
         * Properties of a ScheduleCardsAsNewDefaultsRequest.
         * @deprecated Use anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties instead.
         */
        interface IScheduleCardsAsNewDefaultsRequest extends anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties {
        }

        /** Represents a ScheduleCardsAsNewDefaultsRequest. */
        class ScheduleCardsAsNewDefaultsRequest {

            /**
             * Constructs a new ScheduleCardsAsNewDefaultsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ScheduleCardsAsNewDefaultsRequest context. */
            context: anki.scheduler.ScheduleCardsAsNewRequest.Context;

            /**
             * Creates a new ScheduleCardsAsNewDefaultsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ScheduleCardsAsNewDefaultsRequest instance
             */
            static create(properties: anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Shape): anki.scheduler.ScheduleCardsAsNewDefaultsRequest & anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Shape;
            static create(properties?: anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties): anki.scheduler.ScheduleCardsAsNewDefaultsRequest;

            /**
             * Encodes the specified ScheduleCardsAsNewDefaultsRequest message. Does not implicitly {@link anki.scheduler.ScheduleCardsAsNewDefaultsRequest.verify|verify} messages.
             * @param message ScheduleCardsAsNewDefaultsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ScheduleCardsAsNewDefaultsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ScheduleCardsAsNewDefaultsRequest & anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Shape} ScheduleCardsAsNewDefaultsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ScheduleCardsAsNewDefaultsRequest & anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Shape;
        }

        namespace ScheduleCardsAsNewDefaultsRequest {

            /** Properties of a ScheduleCardsAsNewDefaultsRequest. */
            interface $Properties {

                /** ScheduleCardsAsNewDefaultsRequest context */
                context?: (anki.scheduler.ScheduleCardsAsNewRequest.Context|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ScheduleCardsAsNewDefaultsRequest. */
            type $Shape = anki.scheduler.ScheduleCardsAsNewDefaultsRequest.$Properties;
        }

        /**
         * Properties of a ScheduleCardsAsNewDefaultsResponse.
         * @deprecated Use anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties instead.
         */
        interface IScheduleCardsAsNewDefaultsResponse extends anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties {
        }

        /** Represents a ScheduleCardsAsNewDefaultsResponse. */
        class ScheduleCardsAsNewDefaultsResponse {

            /**
             * Constructs a new ScheduleCardsAsNewDefaultsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ScheduleCardsAsNewDefaultsResponse restorePosition. */
            restorePosition: boolean;

            /** ScheduleCardsAsNewDefaultsResponse resetCounts. */
            resetCounts: boolean;

            /**
             * Creates a new ScheduleCardsAsNewDefaultsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ScheduleCardsAsNewDefaultsResponse instance
             */
            static create(properties: anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Shape): anki.scheduler.ScheduleCardsAsNewDefaultsResponse & anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Shape;
            static create(properties?: anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties): anki.scheduler.ScheduleCardsAsNewDefaultsResponse;

            /**
             * Encodes the specified ScheduleCardsAsNewDefaultsResponse message. Does not implicitly {@link anki.scheduler.ScheduleCardsAsNewDefaultsResponse.verify|verify} messages.
             * @param message ScheduleCardsAsNewDefaultsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ScheduleCardsAsNewDefaultsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ScheduleCardsAsNewDefaultsResponse & anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Shape} ScheduleCardsAsNewDefaultsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ScheduleCardsAsNewDefaultsResponse & anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Shape;
        }

        namespace ScheduleCardsAsNewDefaultsResponse {

            /** Properties of a ScheduleCardsAsNewDefaultsResponse. */
            interface $Properties {

                /** ScheduleCardsAsNewDefaultsResponse restorePosition */
                restorePosition?: (boolean|null);

                /** ScheduleCardsAsNewDefaultsResponse resetCounts */
                resetCounts?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ScheduleCardsAsNewDefaultsResponse. */
            type $Shape = anki.scheduler.ScheduleCardsAsNewDefaultsResponse.$Properties;
        }

        /**
         * Properties of a SetDueDateRequest.
         * @deprecated Use anki.scheduler.SetDueDateRequest.$Properties instead.
         */
        interface ISetDueDateRequest extends anki.scheduler.SetDueDateRequest.$Properties {
        }

        /** Represents a SetDueDateRequest. */
        class SetDueDateRequest {

            /**
             * Constructs a new SetDueDateRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SetDueDateRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SetDueDateRequest cardIds. */
            cardIds: (number|Long)[];

            /** SetDueDateRequest days. */
            days: string;

            /** SetDueDateRequest configKey. */
            configKey?: (anki.config.OptionalStringConfigKey.$Properties|null);

            /**
             * Creates a new SetDueDateRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SetDueDateRequest instance
             */
            static create(properties: anki.scheduler.SetDueDateRequest.$Shape): anki.scheduler.SetDueDateRequest & anki.scheduler.SetDueDateRequest.$Shape;
            static create(properties?: anki.scheduler.SetDueDateRequest.$Properties): anki.scheduler.SetDueDateRequest;

            /**
             * Encodes the specified SetDueDateRequest message. Does not implicitly {@link anki.scheduler.SetDueDateRequest.verify|verify} messages.
             * @param message SetDueDateRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SetDueDateRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SetDueDateRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SetDueDateRequest & anki.scheduler.SetDueDateRequest.$Shape} SetDueDateRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SetDueDateRequest & anki.scheduler.SetDueDateRequest.$Shape;
        }

        namespace SetDueDateRequest {

            /** Properties of a SetDueDateRequest. */
            interface $Properties {

                /** SetDueDateRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** SetDueDateRequest days */
                days?: (string|null);

                /** SetDueDateRequest configKey */
                configKey?: (anki.config.OptionalStringConfigKey.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SetDueDateRequest. */
            type $Shape = anki.scheduler.SetDueDateRequest.$Properties;
        }

        /**
         * Properties of a SortCardsRequest.
         * @deprecated Use anki.scheduler.SortCardsRequest.$Properties instead.
         */
        interface ISortCardsRequest extends anki.scheduler.SortCardsRequest.$Properties {
        }

        /** Represents a SortCardsRequest. */
        class SortCardsRequest {

            /**
             * Constructs a new SortCardsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SortCardsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SortCardsRequest cardIds. */
            cardIds: (number|Long)[];

            /** SortCardsRequest startingFrom. */
            startingFrom: number;

            /** SortCardsRequest stepSize. */
            stepSize: number;

            /** SortCardsRequest randomize. */
            randomize: boolean;

            /** SortCardsRequest shiftExisting. */
            shiftExisting: boolean;

            /**
             * Creates a new SortCardsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SortCardsRequest instance
             */
            static create(properties: anki.scheduler.SortCardsRequest.$Shape): anki.scheduler.SortCardsRequest & anki.scheduler.SortCardsRequest.$Shape;
            static create(properties?: anki.scheduler.SortCardsRequest.$Properties): anki.scheduler.SortCardsRequest;

            /**
             * Encodes the specified SortCardsRequest message. Does not implicitly {@link anki.scheduler.SortCardsRequest.verify|verify} messages.
             * @param message SortCardsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SortCardsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SortCardsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SortCardsRequest & anki.scheduler.SortCardsRequest.$Shape} SortCardsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SortCardsRequest & anki.scheduler.SortCardsRequest.$Shape;
        }

        namespace SortCardsRequest {

            /** Properties of a SortCardsRequest. */
            interface $Properties {

                /** SortCardsRequest cardIds */
                cardIds?: ((number|Long)[]|null);

                /** SortCardsRequest startingFrom */
                startingFrom?: (number|null);

                /** SortCardsRequest stepSize */
                stepSize?: (number|null);

                /** SortCardsRequest randomize */
                randomize?: (boolean|null);

                /** SortCardsRequest shiftExisting */
                shiftExisting?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SortCardsRequest. */
            type $Shape = anki.scheduler.SortCardsRequest.$Properties;
        }

        /**
         * Properties of a SortDeckRequest.
         * @deprecated Use anki.scheduler.SortDeckRequest.$Properties instead.
         */
        interface ISortDeckRequest extends anki.scheduler.SortDeckRequest.$Properties {
        }

        /** Represents a SortDeckRequest. */
        class SortDeckRequest {

            /**
             * Constructs a new SortDeckRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SortDeckRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SortDeckRequest deckId. */
            deckId: (number|Long);

            /** SortDeckRequest randomize. */
            randomize: boolean;

            /**
             * Creates a new SortDeckRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SortDeckRequest instance
             */
            static create(properties: anki.scheduler.SortDeckRequest.$Shape): anki.scheduler.SortDeckRequest & anki.scheduler.SortDeckRequest.$Shape;
            static create(properties?: anki.scheduler.SortDeckRequest.$Properties): anki.scheduler.SortDeckRequest;

            /**
             * Encodes the specified SortDeckRequest message. Does not implicitly {@link anki.scheduler.SortDeckRequest.verify|verify} messages.
             * @param message SortDeckRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SortDeckRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SortDeckRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SortDeckRequest & anki.scheduler.SortDeckRequest.$Shape} SortDeckRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SortDeckRequest & anki.scheduler.SortDeckRequest.$Shape;
        }

        namespace SortDeckRequest {

            /** Properties of a SortDeckRequest. */
            interface $Properties {

                /** SortDeckRequest deckId */
                deckId?: (number|Long|null);

                /** SortDeckRequest randomize */
                randomize?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SortDeckRequest. */
            type $Shape = anki.scheduler.SortDeckRequest.$Properties;
        }

        /**
         * Properties of a SchedulingStates.
         * @deprecated Use anki.scheduler.SchedulingStates.$Properties instead.
         */
        interface ISchedulingStates extends anki.scheduler.SchedulingStates.$Properties {
        }

        /** Represents a SchedulingStates. */
        class SchedulingStates {

            /**
             * Constructs a new SchedulingStates.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SchedulingStates.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SchedulingStates current. */
            current?: (anki.scheduler.SchedulingState.$Properties|null);

            /** SchedulingStates again. */
            again?: (anki.scheduler.SchedulingState.$Properties|null);

            /** SchedulingStates hard. */
            hard?: (anki.scheduler.SchedulingState.$Properties|null);

            /** SchedulingStates good. */
            good?: (anki.scheduler.SchedulingState.$Properties|null);

            /** SchedulingStates easy. */
            easy?: (anki.scheduler.SchedulingState.$Properties|null);

            /**
             * Creates a new SchedulingStates instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SchedulingStates instance
             */
            static create(properties: anki.scheduler.SchedulingStates.$Shape): anki.scheduler.SchedulingStates & anki.scheduler.SchedulingStates.$Shape;
            static create(properties?: anki.scheduler.SchedulingStates.$Properties): anki.scheduler.SchedulingStates;

            /**
             * Encodes the specified SchedulingStates message. Does not implicitly {@link anki.scheduler.SchedulingStates.verify|verify} messages.
             * @param message SchedulingStates message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SchedulingStates.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SchedulingStates message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SchedulingStates & anki.scheduler.SchedulingStates.$Shape} SchedulingStates
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingStates & anki.scheduler.SchedulingStates.$Shape;
        }

        namespace SchedulingStates {

            /** Properties of a SchedulingStates. */
            interface $Properties {

                /** SchedulingStates current */
                current?: (anki.scheduler.SchedulingState.$Properties|null);

                /** SchedulingStates again */
                again?: (anki.scheduler.SchedulingState.$Properties|null);

                /** SchedulingStates hard */
                hard?: (anki.scheduler.SchedulingState.$Properties|null);

                /** SchedulingStates good */
                good?: (anki.scheduler.SchedulingState.$Properties|null);

                /** SchedulingStates easy */
                easy?: (anki.scheduler.SchedulingState.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SchedulingStates. */
            type $Shape = {
              current?: anki.scheduler.SchedulingState.$Shape|null;
              again?: anki.scheduler.SchedulingState.$Shape|null;
              hard?: anki.scheduler.SchedulingState.$Shape|null;
              good?: anki.scheduler.SchedulingState.$Shape|null;
              easy?: anki.scheduler.SchedulingState.$Shape|null;
              $unknowns?: Uint8Array[];
            };
        }

        /**
         * Properties of a CardAnswer.
         * @deprecated Use anki.scheduler.CardAnswer.$Properties instead.
         */
        interface ICardAnswer extends anki.scheduler.CardAnswer.$Properties {
        }

        /** Represents a CardAnswer. */
        class CardAnswer {

            /**
             * Constructs a new CardAnswer.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CardAnswer.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CardAnswer cardId. */
            cardId: (number|Long);

            /** CardAnswer currentState. */
            currentState?: (anki.scheduler.SchedulingState.$Properties|null);

            /** CardAnswer newState. */
            newState?: (anki.scheduler.SchedulingState.$Properties|null);

            /** CardAnswer rating. */
            rating: anki.scheduler.CardAnswer.Rating;

            /** CardAnswer answeredAtMillis. */
            answeredAtMillis: (number|Long);

            /** CardAnswer millisecondsTaken. */
            millisecondsTaken: number;

            /**
             * Creates a new CardAnswer instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CardAnswer instance
             */
            static create(properties: anki.scheduler.CardAnswer.$Shape): anki.scheduler.CardAnswer & anki.scheduler.CardAnswer.$Shape;
            static create(properties?: anki.scheduler.CardAnswer.$Properties): anki.scheduler.CardAnswer;

            /**
             * Encodes the specified CardAnswer message. Does not implicitly {@link anki.scheduler.CardAnswer.verify|verify} messages.
             * @param message CardAnswer message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CardAnswer.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CardAnswer message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CardAnswer & anki.scheduler.CardAnswer.$Shape} CardAnswer
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CardAnswer & anki.scheduler.CardAnswer.$Shape;
        }

        namespace CardAnswer {

            /** Properties of a CardAnswer. */
            interface $Properties {

                /** CardAnswer cardId */
                cardId?: (number|Long|null);

                /** CardAnswer currentState */
                currentState?: (anki.scheduler.SchedulingState.$Properties|null);

                /** CardAnswer newState */
                newState?: (anki.scheduler.SchedulingState.$Properties|null);

                /** CardAnswer rating */
                rating?: (anki.scheduler.CardAnswer.Rating|null);

                /** CardAnswer answeredAtMillis */
                answeredAtMillis?: (number|Long|null);

                /** CardAnswer millisecondsTaken */
                millisecondsTaken?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CardAnswer. */
            type $Shape = {
              cardId?: number|Long|null;
              currentState?: anki.scheduler.SchedulingState.$Shape|null;
              newState?: anki.scheduler.SchedulingState.$Shape|null;
              rating?: anki.scheduler.CardAnswer.Rating|null;
              answeredAtMillis?: number|Long|null;
              millisecondsTaken?: number|null;
              $unknowns?: Uint8Array[];
            };

            /** Rating enum. */
            enum Rating {

                /** AGAIN value */
                AGAIN = 0,

                /** HARD value */
                HARD = 1,

                /** GOOD value */
                GOOD = 2,

                /** EASY value */
                EASY = 3
            }
        }

        /**
         * Properties of a CustomStudyRequest.
         * @deprecated Use anki.scheduler.CustomStudyRequest.$Properties instead.
         */
        interface ICustomStudyRequest extends anki.scheduler.CustomStudyRequest.$Properties {
        }

        /** Represents a CustomStudyRequest. */
        class CustomStudyRequest {

            /**
             * Constructs a new CustomStudyRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CustomStudyRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CustomStudyRequest deckId. */
            deckId: (number|Long);

            /** CustomStudyRequest newLimitDelta. */
            newLimitDelta?: (number|null);

            /** CustomStudyRequest reviewLimitDelta. */
            reviewLimitDelta?: (number|null);

            /** CustomStudyRequest forgotDays. */
            forgotDays?: (number|null);

            /** CustomStudyRequest reviewAheadDays. */
            reviewAheadDays?: (number|null);

            /** CustomStudyRequest previewDays. */
            previewDays?: (number|null);

            /** CustomStudyRequest cram. */
            cram?: (anki.scheduler.CustomStudyRequest.Cram.$Properties|null);

            /** CustomStudyRequest value. */
            value?: ("newLimitDelta"|"reviewLimitDelta"|"forgotDays"|"reviewAheadDays"|"previewDays"|"cram");

            /**
             * Creates a new CustomStudyRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CustomStudyRequest instance
             */
            static create(properties: anki.scheduler.CustomStudyRequest.$Shape): anki.scheduler.CustomStudyRequest & anki.scheduler.CustomStudyRequest.$Shape;
            static create(properties?: anki.scheduler.CustomStudyRequest.$Properties): anki.scheduler.CustomStudyRequest;

            /**
             * Encodes the specified CustomStudyRequest message. Does not implicitly {@link anki.scheduler.CustomStudyRequest.verify|verify} messages.
             * @param message CustomStudyRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CustomStudyRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CustomStudyRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CustomStudyRequest & anki.scheduler.CustomStudyRequest.$Shape} CustomStudyRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CustomStudyRequest & anki.scheduler.CustomStudyRequest.$Shape;
        }

        namespace CustomStudyRequest {

            /** Properties of a CustomStudyRequest. */
            interface $Properties {

                /** CustomStudyRequest deckId */
                deckId?: (number|Long|null);

                /** CustomStudyRequest newLimitDelta */
                newLimitDelta?: (number|null);

                /** CustomStudyRequest reviewLimitDelta */
                reviewLimitDelta?: (number|null);

                /** CustomStudyRequest forgotDays */
                forgotDays?: (number|null);

                /** CustomStudyRequest reviewAheadDays */
                reviewAheadDays?: (number|null);

                /** CustomStudyRequest previewDays */
                previewDays?: (number|null);

                /** CustomStudyRequest cram */
                cram?: (anki.scheduler.CustomStudyRequest.Cram.$Properties|null);

                /** CustomStudyRequest value */
                value?: ("newLimitDelta"|"reviewLimitDelta"|"forgotDays"|"reviewAheadDays"|"previewDays"|"cram");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a CustomStudyRequest. */
            type $Shape = {
              deckId?: number|Long|null;
              newLimitDelta?: number|null;
              reviewLimitDelta?: number|null;
              forgotDays?: number|null;
              reviewAheadDays?: number|null;
              previewDays?: number|null;
              cram?: anki.scheduler.CustomStudyRequest.Cram.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ value?: undefined; newLimitDelta?: null; reviewLimitDelta?: null; forgotDays?: null; reviewAheadDays?: null; previewDays?: null; cram?: null }|{ value?: "newLimitDelta"; newLimitDelta: number; reviewLimitDelta?: null; forgotDays?: null; reviewAheadDays?: null; previewDays?: null; cram?: null }|{ value?: "reviewLimitDelta"; newLimitDelta?: null; reviewLimitDelta: number; forgotDays?: null; reviewAheadDays?: null; previewDays?: null; cram?: null }|{ value?: "forgotDays"; newLimitDelta?: null; reviewLimitDelta?: null; forgotDays: number; reviewAheadDays?: null; previewDays?: null; cram?: null }|{ value?: "reviewAheadDays"; newLimitDelta?: null; reviewLimitDelta?: null; forgotDays?: null; reviewAheadDays: number; previewDays?: null; cram?: null }|{ value?: "previewDays"; newLimitDelta?: null; reviewLimitDelta?: null; forgotDays?: null; reviewAheadDays?: null; previewDays: number; cram?: null }|{ value?: "cram"; newLimitDelta?: null; reviewLimitDelta?: null; forgotDays?: null; reviewAheadDays?: null; previewDays?: null; cram: anki.scheduler.CustomStudyRequest.Cram.$Shape })
            );

            /**
             * Properties of a Cram.
             * @deprecated Use anki.scheduler.CustomStudyRequest.Cram.$Properties instead.
             */
            interface ICram extends anki.scheduler.CustomStudyRequest.Cram.$Properties {
            }

            /** Represents a Cram. */
            class Cram {

                /**
                 * Constructs a new Cram.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.CustomStudyRequest.Cram.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Cram kind. */
                kind: anki.scheduler.CustomStudyRequest.Cram.CramKind;

                /** Cram cardLimit. */
                cardLimit: number;

                /** Cram tagsToInclude. */
                tagsToInclude: string[];

                /** Cram tagsToExclude. */
                tagsToExclude: string[];

                /**
                 * Creates a new Cram instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Cram instance
                 */
                static create(properties: anki.scheduler.CustomStudyRequest.Cram.$Shape): anki.scheduler.CustomStudyRequest.Cram & anki.scheduler.CustomStudyRequest.Cram.$Shape;
                static create(properties?: anki.scheduler.CustomStudyRequest.Cram.$Properties): anki.scheduler.CustomStudyRequest.Cram;

                /**
                 * Encodes the specified Cram message. Does not implicitly {@link anki.scheduler.CustomStudyRequest.Cram.verify|verify} messages.
                 * @param message Cram message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.CustomStudyRequest.Cram.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Cram message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.CustomStudyRequest.Cram & anki.scheduler.CustomStudyRequest.Cram.$Shape} Cram
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CustomStudyRequest.Cram & anki.scheduler.CustomStudyRequest.Cram.$Shape;
            }

            namespace Cram {

                /** Properties of a Cram. */
                interface $Properties {

                    /** Cram kind */
                    kind?: (anki.scheduler.CustomStudyRequest.Cram.CramKind|null);

                    /** Cram cardLimit */
                    cardLimit?: (number|null);

                    /** Cram tagsToInclude */
                    tagsToInclude?: (string[]|null);

                    /** Cram tagsToExclude */
                    tagsToExclude?: (string[]|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Cram. */
                type $Shape = anki.scheduler.CustomStudyRequest.Cram.$Properties;

                /** CramKind enum. */
                enum CramKind {

                    /** CRAM_KIND_DUE value */
                    CRAM_KIND_DUE = 0,

                    /** CRAM_KIND_NEW value */
                    CRAM_KIND_NEW = 1,

                    /** CRAM_KIND_REVIEW value */
                    CRAM_KIND_REVIEW = 2,

                    /** CRAM_KIND_ALL value */
                    CRAM_KIND_ALL = 3
                }
            }
        }

        /**
         * Properties of a SchedulingContext.
         * @deprecated Use anki.scheduler.SchedulingContext.$Properties instead.
         */
        interface ISchedulingContext extends anki.scheduler.SchedulingContext.$Properties {
        }

        /** Represents a SchedulingContext. */
        class SchedulingContext {

            /**
             * Constructs a new SchedulingContext.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SchedulingContext.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SchedulingContext deckName. */
            deckName: string;

            /** SchedulingContext seed. */
            seed: (number|Long);

            /** SchedulingContext decay. */
            decay?: (number|null);

            /** SchedulingContext desiredRetention. */
            desiredRetention?: (number|null);

            /**
             * Creates a new SchedulingContext instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SchedulingContext instance
             */
            static create(properties: anki.scheduler.SchedulingContext.$Shape): anki.scheduler.SchedulingContext & anki.scheduler.SchedulingContext.$Shape;
            static create(properties?: anki.scheduler.SchedulingContext.$Properties): anki.scheduler.SchedulingContext;

            /**
             * Encodes the specified SchedulingContext message. Does not implicitly {@link anki.scheduler.SchedulingContext.verify|verify} messages.
             * @param message SchedulingContext message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SchedulingContext.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SchedulingContext message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SchedulingContext & anki.scheduler.SchedulingContext.$Shape} SchedulingContext
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SchedulingContext & anki.scheduler.SchedulingContext.$Shape;
        }

        namespace SchedulingContext {

            /** Properties of a SchedulingContext. */
            interface $Properties {

                /** SchedulingContext deckName */
                deckName?: (string|null);

                /** SchedulingContext seed */
                seed?: (number|Long|null);

                /** SchedulingContext decay */
                decay?: (number|null);

                /** SchedulingContext desiredRetention */
                desiredRetention?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SchedulingContext. */
            type $Shape = anki.scheduler.SchedulingContext.$Properties;
        }

        /**
         * Properties of a CustomStudyDefaultsRequest.
         * @deprecated Use anki.scheduler.CustomStudyDefaultsRequest.$Properties instead.
         */
        interface ICustomStudyDefaultsRequest extends anki.scheduler.CustomStudyDefaultsRequest.$Properties {
        }

        /** Represents a CustomStudyDefaultsRequest. */
        class CustomStudyDefaultsRequest {

            /**
             * Constructs a new CustomStudyDefaultsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CustomStudyDefaultsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CustomStudyDefaultsRequest deckId. */
            deckId: (number|Long);

            /**
             * Creates a new CustomStudyDefaultsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CustomStudyDefaultsRequest instance
             */
            static create(properties: anki.scheduler.CustomStudyDefaultsRequest.$Shape): anki.scheduler.CustomStudyDefaultsRequest & anki.scheduler.CustomStudyDefaultsRequest.$Shape;
            static create(properties?: anki.scheduler.CustomStudyDefaultsRequest.$Properties): anki.scheduler.CustomStudyDefaultsRequest;

            /**
             * Encodes the specified CustomStudyDefaultsRequest message. Does not implicitly {@link anki.scheduler.CustomStudyDefaultsRequest.verify|verify} messages.
             * @param message CustomStudyDefaultsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CustomStudyDefaultsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CustomStudyDefaultsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CustomStudyDefaultsRequest & anki.scheduler.CustomStudyDefaultsRequest.$Shape} CustomStudyDefaultsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CustomStudyDefaultsRequest & anki.scheduler.CustomStudyDefaultsRequest.$Shape;
        }

        namespace CustomStudyDefaultsRequest {

            /** Properties of a CustomStudyDefaultsRequest. */
            interface $Properties {

                /** CustomStudyDefaultsRequest deckId */
                deckId?: (number|Long|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CustomStudyDefaultsRequest. */
            type $Shape = anki.scheduler.CustomStudyDefaultsRequest.$Properties;
        }

        /**
         * Properties of a CustomStudyDefaultsResponse.
         * @deprecated Use anki.scheduler.CustomStudyDefaultsResponse.$Properties instead.
         */
        interface ICustomStudyDefaultsResponse extends anki.scheduler.CustomStudyDefaultsResponse.$Properties {
        }

        /** Represents a CustomStudyDefaultsResponse. */
        class CustomStudyDefaultsResponse {

            /**
             * Constructs a new CustomStudyDefaultsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.CustomStudyDefaultsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CustomStudyDefaultsResponse tags. */
            tags: anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties[];

            /** CustomStudyDefaultsResponse extendNew. */
            extendNew: number;

            /** CustomStudyDefaultsResponse extendReview. */
            extendReview: number;

            /** CustomStudyDefaultsResponse availableNew. */
            availableNew: number;

            /** CustomStudyDefaultsResponse availableReview. */
            availableReview: number;

            /** CustomStudyDefaultsResponse availableNewInChildren. */
            availableNewInChildren: number;

            /** CustomStudyDefaultsResponse availableReviewInChildren. */
            availableReviewInChildren: number;

            /**
             * Creates a new CustomStudyDefaultsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CustomStudyDefaultsResponse instance
             */
            static create(properties: anki.scheduler.CustomStudyDefaultsResponse.$Shape): anki.scheduler.CustomStudyDefaultsResponse & anki.scheduler.CustomStudyDefaultsResponse.$Shape;
            static create(properties?: anki.scheduler.CustomStudyDefaultsResponse.$Properties): anki.scheduler.CustomStudyDefaultsResponse;

            /**
             * Encodes the specified CustomStudyDefaultsResponse message. Does not implicitly {@link anki.scheduler.CustomStudyDefaultsResponse.verify|verify} messages.
             * @param message CustomStudyDefaultsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.CustomStudyDefaultsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CustomStudyDefaultsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.CustomStudyDefaultsResponse & anki.scheduler.CustomStudyDefaultsResponse.$Shape} CustomStudyDefaultsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CustomStudyDefaultsResponse & anki.scheduler.CustomStudyDefaultsResponse.$Shape;
        }

        namespace CustomStudyDefaultsResponse {

            /** Properties of a CustomStudyDefaultsResponse. */
            interface $Properties {

                /** CustomStudyDefaultsResponse tags */
                tags?: (anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties[]|null);

                /** CustomStudyDefaultsResponse extendNew */
                extendNew?: (number|null);

                /** CustomStudyDefaultsResponse extendReview */
                extendReview?: (number|null);

                /** CustomStudyDefaultsResponse availableNew */
                availableNew?: (number|null);

                /** CustomStudyDefaultsResponse availableReview */
                availableReview?: (number|null);

                /** CustomStudyDefaultsResponse availableNewInChildren */
                availableNewInChildren?: (number|null);

                /** CustomStudyDefaultsResponse availableReviewInChildren */
                availableReviewInChildren?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CustomStudyDefaultsResponse. */
            type $Shape = anki.scheduler.CustomStudyDefaultsResponse.$Properties;

            /**
             * Properties of a Tag.
             * @deprecated Use anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties instead.
             */
            interface ITag extends anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties {
            }

            /** Represents a Tag. */
            class Tag {

                /**
                 * Constructs a new Tag.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Tag name. */
                name: string;

                /** Tag include. */
                include: boolean;

                /** Tag exclude. */
                exclude: boolean;

                /**
                 * Creates a new Tag instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Tag instance
                 */
                static create(properties: anki.scheduler.CustomStudyDefaultsResponse.Tag.$Shape): anki.scheduler.CustomStudyDefaultsResponse.Tag & anki.scheduler.CustomStudyDefaultsResponse.Tag.$Shape;
                static create(properties?: anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties): anki.scheduler.CustomStudyDefaultsResponse.Tag;

                /**
                 * Encodes the specified Tag message. Does not implicitly {@link anki.scheduler.CustomStudyDefaultsResponse.Tag.verify|verify} messages.
                 * @param message Tag message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Tag message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.scheduler.CustomStudyDefaultsResponse.Tag & anki.scheduler.CustomStudyDefaultsResponse.Tag.$Shape} Tag
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.CustomStudyDefaultsResponse.Tag & anki.scheduler.CustomStudyDefaultsResponse.Tag.$Shape;
            }

            namespace Tag {

                /** Properties of a Tag. */
                interface $Properties {

                    /** Tag name */
                    name?: (string|null);

                    /** Tag include */
                    include?: (boolean|null);

                    /** Tag exclude */
                    exclude?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Tag. */
                type $Shape = anki.scheduler.CustomStudyDefaultsResponse.Tag.$Properties;
            }
        }

        /**
         * Properties of a RepositionDefaultsResponse.
         * @deprecated Use anki.scheduler.RepositionDefaultsResponse.$Properties instead.
         */
        interface IRepositionDefaultsResponse extends anki.scheduler.RepositionDefaultsResponse.$Properties {
        }

        /** Represents a RepositionDefaultsResponse. */
        class RepositionDefaultsResponse {

            /**
             * Constructs a new RepositionDefaultsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.RepositionDefaultsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RepositionDefaultsResponse random. */
            random: boolean;

            /** RepositionDefaultsResponse shift. */
            shift: boolean;

            /**
             * Creates a new RepositionDefaultsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RepositionDefaultsResponse instance
             */
            static create(properties: anki.scheduler.RepositionDefaultsResponse.$Shape): anki.scheduler.RepositionDefaultsResponse & anki.scheduler.RepositionDefaultsResponse.$Shape;
            static create(properties?: anki.scheduler.RepositionDefaultsResponse.$Properties): anki.scheduler.RepositionDefaultsResponse;

            /**
             * Encodes the specified RepositionDefaultsResponse message. Does not implicitly {@link anki.scheduler.RepositionDefaultsResponse.verify|verify} messages.
             * @param message RepositionDefaultsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.RepositionDefaultsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RepositionDefaultsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.RepositionDefaultsResponse & anki.scheduler.RepositionDefaultsResponse.$Shape} RepositionDefaultsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.RepositionDefaultsResponse & anki.scheduler.RepositionDefaultsResponse.$Shape;
        }

        namespace RepositionDefaultsResponse {

            /** Properties of a RepositionDefaultsResponse. */
            interface $Properties {

                /** RepositionDefaultsResponse random */
                random?: (boolean|null);

                /** RepositionDefaultsResponse shift */
                shift?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RepositionDefaultsResponse. */
            type $Shape = anki.scheduler.RepositionDefaultsResponse.$Properties;
        }

        /**
         * Properties of a ComputeFsrsParamsRequest.
         * @deprecated Use anki.scheduler.ComputeFsrsParamsRequest.$Properties instead.
         */
        interface IComputeFsrsParamsRequest extends anki.scheduler.ComputeFsrsParamsRequest.$Properties {
        }

        /** Represents a ComputeFsrsParamsRequest. */
        class ComputeFsrsParamsRequest {

            /**
             * Constructs a new ComputeFsrsParamsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ComputeFsrsParamsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ComputeFsrsParamsRequest search. */
            search: string;

            /** ComputeFsrsParamsRequest currentParams. */
            currentParams: number[];

            /** ComputeFsrsParamsRequest ignoreRevlogsBeforeMs. */
            ignoreRevlogsBeforeMs: (number|Long);

            /** ComputeFsrsParamsRequest numOfRelearningSteps. */
            numOfRelearningSteps: number;

            /** ComputeFsrsParamsRequest healthCheck. */
            healthCheck: boolean;

            /**
             * Creates a new ComputeFsrsParamsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ComputeFsrsParamsRequest instance
             */
            static create(properties: anki.scheduler.ComputeFsrsParamsRequest.$Shape): anki.scheduler.ComputeFsrsParamsRequest & anki.scheduler.ComputeFsrsParamsRequest.$Shape;
            static create(properties?: anki.scheduler.ComputeFsrsParamsRequest.$Properties): anki.scheduler.ComputeFsrsParamsRequest;

            /**
             * Encodes the specified ComputeFsrsParamsRequest message. Does not implicitly {@link anki.scheduler.ComputeFsrsParamsRequest.verify|verify} messages.
             * @param message ComputeFsrsParamsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ComputeFsrsParamsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ComputeFsrsParamsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ComputeFsrsParamsRequest & anki.scheduler.ComputeFsrsParamsRequest.$Shape} ComputeFsrsParamsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ComputeFsrsParamsRequest & anki.scheduler.ComputeFsrsParamsRequest.$Shape;
        }

        namespace ComputeFsrsParamsRequest {

            /** Properties of a ComputeFsrsParamsRequest. */
            interface $Properties {

                /** ComputeFsrsParamsRequest search */
                search?: (string|null);

                /** ComputeFsrsParamsRequest currentParams */
                currentParams?: (number[]|null);

                /** ComputeFsrsParamsRequest ignoreRevlogsBeforeMs */
                ignoreRevlogsBeforeMs?: (number|Long|null);

                /** ComputeFsrsParamsRequest numOfRelearningSteps */
                numOfRelearningSteps?: (number|null);

                /** ComputeFsrsParamsRequest healthCheck */
                healthCheck?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ComputeFsrsParamsRequest. */
            type $Shape = anki.scheduler.ComputeFsrsParamsRequest.$Properties;
        }

        /**
         * Properties of a ComputeFsrsParamsResponse.
         * @deprecated Use anki.scheduler.ComputeFsrsParamsResponse.$Properties instead.
         */
        interface IComputeFsrsParamsResponse extends anki.scheduler.ComputeFsrsParamsResponse.$Properties {
        }

        /** Represents a ComputeFsrsParamsResponse. */
        class ComputeFsrsParamsResponse {

            /**
             * Constructs a new ComputeFsrsParamsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ComputeFsrsParamsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ComputeFsrsParamsResponse params. */
            params: number[];

            /** ComputeFsrsParamsResponse fsrsItems. */
            fsrsItems: number;

            /** ComputeFsrsParamsResponse healthCheckPassed. */
            healthCheckPassed?: (boolean|null);

            /**
             * Creates a new ComputeFsrsParamsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ComputeFsrsParamsResponse instance
             */
            static create(properties: anki.scheduler.ComputeFsrsParamsResponse.$Shape): anki.scheduler.ComputeFsrsParamsResponse & anki.scheduler.ComputeFsrsParamsResponse.$Shape;
            static create(properties?: anki.scheduler.ComputeFsrsParamsResponse.$Properties): anki.scheduler.ComputeFsrsParamsResponse;

            /**
             * Encodes the specified ComputeFsrsParamsResponse message. Does not implicitly {@link anki.scheduler.ComputeFsrsParamsResponse.verify|verify} messages.
             * @param message ComputeFsrsParamsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ComputeFsrsParamsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ComputeFsrsParamsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ComputeFsrsParamsResponse & anki.scheduler.ComputeFsrsParamsResponse.$Shape} ComputeFsrsParamsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ComputeFsrsParamsResponse & anki.scheduler.ComputeFsrsParamsResponse.$Shape;
        }

        namespace ComputeFsrsParamsResponse {

            /** Properties of a ComputeFsrsParamsResponse. */
            interface $Properties {

                /** ComputeFsrsParamsResponse params */
                params?: (number[]|null);

                /** ComputeFsrsParamsResponse fsrsItems */
                fsrsItems?: (number|null);

                /** ComputeFsrsParamsResponse healthCheckPassed */
                healthCheckPassed?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ComputeFsrsParamsResponse. */
            type $Shape = anki.scheduler.ComputeFsrsParamsResponse.$Properties;
        }

        /**
         * Properties of a SimulateFsrsReviewRequest.
         * @deprecated Use anki.scheduler.SimulateFsrsReviewRequest.$Properties instead.
         */
        interface ISimulateFsrsReviewRequest extends anki.scheduler.SimulateFsrsReviewRequest.$Properties {
        }

        /** Represents a SimulateFsrsReviewRequest. */
        class SimulateFsrsReviewRequest {

            /**
             * Constructs a new SimulateFsrsReviewRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.SimulateFsrsReviewRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SimulateFsrsReviewRequest params. */
            params: number[];

            /** SimulateFsrsReviewRequest desiredRetention. */
            desiredRetention: number;

            /** SimulateFsrsReviewRequest deckSize. */
            deckSize: number;

            /** SimulateFsrsReviewRequest daysToSimulate. */
            daysToSimulate: number;

            /** SimulateFsrsReviewRequest newLimit. */
            newLimit: number;

            /** SimulateFsrsReviewRequest reviewLimit. */
            reviewLimit: number;

            /** SimulateFsrsReviewRequest maxInterval. */
            maxInterval: number;

            /** SimulateFsrsReviewRequest search. */
            search: string;

            /** SimulateFsrsReviewRequest newCardsIgnoreReviewLimit. */
            newCardsIgnoreReviewLimit: boolean;

            /** SimulateFsrsReviewRequest easyDaysPercentages. */
            easyDaysPercentages: number[];

            /** SimulateFsrsReviewRequest reviewOrder. */
            reviewOrder: anki.deck_config.DeckConfig.Config.ReviewCardOrder;

            /** SimulateFsrsReviewRequest suspendAfterLapseCount. */
            suspendAfterLapseCount?: (number|null);

            /** SimulateFsrsReviewRequest historicalRetention. */
            historicalRetention: number;

            /** SimulateFsrsReviewRequest learningStepCount. */
            learningStepCount: number;

            /** SimulateFsrsReviewRequest relearningStepCount. */
            relearningStepCount: number;

            /**
             * Creates a new SimulateFsrsReviewRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SimulateFsrsReviewRequest instance
             */
            static create(properties: anki.scheduler.SimulateFsrsReviewRequest.$Shape): anki.scheduler.SimulateFsrsReviewRequest & anki.scheduler.SimulateFsrsReviewRequest.$Shape;
            static create(properties?: anki.scheduler.SimulateFsrsReviewRequest.$Properties): anki.scheduler.SimulateFsrsReviewRequest;

            /**
             * Encodes the specified SimulateFsrsReviewRequest message. Does not implicitly {@link anki.scheduler.SimulateFsrsReviewRequest.verify|verify} messages.
             * @param message SimulateFsrsReviewRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.SimulateFsrsReviewRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SimulateFsrsReviewRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.SimulateFsrsReviewRequest & anki.scheduler.SimulateFsrsReviewRequest.$Shape} SimulateFsrsReviewRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.SimulateFsrsReviewRequest & anki.scheduler.SimulateFsrsReviewRequest.$Shape;
        }

        namespace SimulateFsrsReviewRequest {

            /** Properties of a SimulateFsrsReviewRequest. */
            interface $Properties {

                /** SimulateFsrsReviewRequest params */
                params?: (number[]|null);

                /** SimulateFsrsReviewRequest desiredRetention */
                desiredRetention?: (number|null);

                /** SimulateFsrsReviewRequest deckSize */
                deckSize?: (number|null);

                /** SimulateFsrsReviewRequest daysToSimulate */
                daysToSimulate?: (number|null);

                /** SimulateFsrsReviewRequest newLimit */
                newLimit?: (number|null);

                /** SimulateFsrsReviewRequest reviewLimit */
                reviewLimit?: (number|null);

                /** SimulateFsrsReviewRequest maxInterval */
                maxInterval?: (number|null);

                /** SimulateFsrsReviewRequest search */
                search?: (string|null);

                /** SimulateFsrsReviewRequest newCardsIgnoreReviewLimit */
                newCardsIgnoreReviewLimit?: (boolean|null);

                /** SimulateFsrsReviewRequest easyDaysPercentages */
                easyDaysPercentages?: (number[]|null);

                /** SimulateFsrsReviewRequest reviewOrder */
                reviewOrder?: (anki.deck_config.DeckConfig.Config.ReviewCardOrder|null);

                /** SimulateFsrsReviewRequest suspendAfterLapseCount */
                suspendAfterLapseCount?: (number|null);

                /** SimulateFsrsReviewRequest historicalRetention */
                historicalRetention?: (number|null);

                /** SimulateFsrsReviewRequest learningStepCount */
                learningStepCount?: (number|null);

                /** SimulateFsrsReviewRequest relearningStepCount */
                relearningStepCount?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SimulateFsrsReviewRequest. */
            type $Shape = anki.scheduler.SimulateFsrsReviewRequest.$Properties;
        }

        /**
         * Properties of a ComputeOptimalRetentionResponse.
         * @deprecated Use anki.scheduler.ComputeOptimalRetentionResponse.$Properties instead.
         */
        interface IComputeOptimalRetentionResponse extends anki.scheduler.ComputeOptimalRetentionResponse.$Properties {
        }

        /** Represents a ComputeOptimalRetentionResponse. */
        class ComputeOptimalRetentionResponse {

            /**
             * Constructs a new ComputeOptimalRetentionResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.scheduler.ComputeOptimalRetentionResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ComputeOptimalRetentionResponse optimalRetention. */
            optimalRetention: number;

            /**
             * Creates a new ComputeOptimalRetentionResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ComputeOptimalRetentionResponse instance
             */
            static create(properties: anki.scheduler.ComputeOptimalRetentionResponse.$Shape): anki.scheduler.ComputeOptimalRetentionResponse & anki.scheduler.ComputeOptimalRetentionResponse.$Shape;
            static create(properties?: anki.scheduler.ComputeOptimalRetentionResponse.$Properties): anki.scheduler.ComputeOptimalRetentionResponse;

            /**
             * Encodes the specified ComputeOptimalRetentionResponse message. Does not implicitly {@link anki.scheduler.ComputeOptimalRetentionResponse.verify|verify} messages.
             * @param message ComputeOptimalRetentionResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.scheduler.ComputeOptimalRetentionResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ComputeOptimalRetentionResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.scheduler.ComputeOptimalRetentionResponse & anki.scheduler.ComputeOptimalRetentionResponse.$Shape} ComputeOptimalRetentionResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.scheduler.ComputeOptimalRetentionResponse & anki.scheduler.ComputeOptimalRetentionResponse.$Shape;
        }

        namespace ComputeOptimalRetentionResponse {

            /** Properties of a ComputeOptimalRetentionResponse. */
            interface $Properties {

                /** ComputeOptimalRetentionResponse optimalRetention */
                optimalRetention?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ComputeOptimalRetentionResponse. */
            type $Shape = anki.scheduler.ComputeOptimalRetentionResponse.$Properties;
        }
    }

    /** Namespace search. */
    namespace search {

        /**
         * Properties of a SearchNode.
         * @deprecated Use anki.search.SearchNode.$Properties instead.
         */
        interface ISearchNode extends anki.search.SearchNode.$Properties {
        }

        /** Represents a SearchNode. */
        class SearchNode {

            /**
             * Constructs a new SearchNode.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.SearchNode.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SearchNode group. */
            group?: (anki.search.SearchNode.Group.$Properties|null);

            /** SearchNode negated. */
            negated?: (anki.search.SearchNode.$Properties|null);

            /** SearchNode parsableText. */
            parsableText?: (string|null);

            /** SearchNode template. */
            template?: (number|null);

            /** SearchNode nid. */
            nid?: (number|Long|null);

            /** SearchNode dupe. */
            dupe?: (anki.search.SearchNode.Dupe.$Properties|null);

            /** SearchNode fieldName. */
            fieldName?: (string|null);

            /** SearchNode rated. */
            rated?: (anki.search.SearchNode.Rated.$Properties|null);

            /** SearchNode addedInDays. */
            addedInDays?: (number|null);

            /** SearchNode dueInDays. */
            dueInDays?: (number|null);

            /** SearchNode flag. */
            flag?: (anki.search.SearchNode.Flag|null);

            /** SearchNode cardState. */
            cardState?: (anki.search.SearchNode.CardState|null);

            /** SearchNode nids. */
            nids?: (anki.search.SearchNode.IdList.$Properties|null);

            /** SearchNode editedInDays. */
            editedInDays?: (number|null);

            /** SearchNode deck. */
            deck?: (string|null);

            /** SearchNode dueOnDay. */
            dueOnDay?: (number|null);

            /** SearchNode tag. */
            tag?: (string|null);

            /** SearchNode note. */
            note?: (string|null);

            /** SearchNode introducedInDays. */
            introducedInDays?: (number|null);

            /** SearchNode field. */
            field?: (anki.search.SearchNode.Field.$Properties|null);

            /** SearchNode literalText. */
            literalText?: (string|null);

            /** SearchNode filter. */
            filter?: ("group"|"negated"|"parsableText"|"template"|"nid"|"dupe"|"fieldName"|"rated"|"addedInDays"|"dueInDays"|"flag"|"cardState"|"nids"|"editedInDays"|"deck"|"dueOnDay"|"tag"|"note"|"introducedInDays"|"field"|"literalText");

            /**
             * Creates a new SearchNode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SearchNode instance
             */
            static create(properties: anki.search.SearchNode.$Shape): anki.search.SearchNode & anki.search.SearchNode.$Shape;
            static create(properties?: anki.search.SearchNode.$Properties): anki.search.SearchNode;

            /**
             * Encodes the specified SearchNode message. Does not implicitly {@link anki.search.SearchNode.verify|verify} messages.
             * @param message SearchNode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.SearchNode.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SearchNode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.SearchNode & anki.search.SearchNode.$Shape} SearchNode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode & anki.search.SearchNode.$Shape;
        }

        namespace SearchNode {

            /** Properties of a SearchNode. */
            interface $Properties {

                /** SearchNode group */
                group?: (anki.search.SearchNode.Group.$Properties|null);

                /** SearchNode negated */
                negated?: (anki.search.SearchNode.$Properties|null);

                /** SearchNode parsableText */
                parsableText?: (string|null);

                /** SearchNode template */
                template?: (number|null);

                /** SearchNode nid */
                nid?: (number|Long|null);

                /** SearchNode dupe */
                dupe?: (anki.search.SearchNode.Dupe.$Properties|null);

                /** SearchNode fieldName */
                fieldName?: (string|null);

                /** SearchNode rated */
                rated?: (anki.search.SearchNode.Rated.$Properties|null);

                /** SearchNode addedInDays */
                addedInDays?: (number|null);

                /** SearchNode dueInDays */
                dueInDays?: (number|null);

                /** SearchNode flag */
                flag?: (anki.search.SearchNode.Flag|null);

                /** SearchNode cardState */
                cardState?: (anki.search.SearchNode.CardState|null);

                /** SearchNode nids */
                nids?: (anki.search.SearchNode.IdList.$Properties|null);

                /** SearchNode editedInDays */
                editedInDays?: (number|null);

                /** SearchNode deck */
                deck?: (string|null);

                /** SearchNode dueOnDay */
                dueOnDay?: (number|null);

                /** SearchNode tag */
                tag?: (string|null);

                /** SearchNode note */
                note?: (string|null);

                /** SearchNode introducedInDays */
                introducedInDays?: (number|null);

                /** SearchNode field */
                field?: (anki.search.SearchNode.Field.$Properties|null);

                /** SearchNode literalText */
                literalText?: (string|null);

                /** SearchNode filter */
                filter?: ("group"|"negated"|"parsableText"|"template"|"nid"|"dupe"|"fieldName"|"rated"|"addedInDays"|"dueInDays"|"flag"|"cardState"|"nids"|"editedInDays"|"deck"|"dueOnDay"|"tag"|"note"|"introducedInDays"|"field"|"literalText");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a SearchNode. */
            type $Shape = {
              group?: anki.search.SearchNode.Group.$Shape|null;
              negated?: anki.search.SearchNode.$Shape|null;
              parsableText?: string|null;
              template?: number|null;
              nid?: number|Long|null;
              dupe?: anki.search.SearchNode.Dupe.$Shape|null;
              fieldName?: string|null;
              rated?: anki.search.SearchNode.Rated.$Shape|null;
              addedInDays?: number|null;
              dueInDays?: number|null;
              flag?: anki.search.SearchNode.Flag|null;
              cardState?: anki.search.SearchNode.CardState|null;
              nids?: anki.search.SearchNode.IdList.$Shape|null;
              editedInDays?: number|null;
              deck?: string|null;
              dueOnDay?: number|null;
              tag?: string|null;
              note?: string|null;
              introducedInDays?: number|null;
              field?: anki.search.SearchNode.Field.$Shape|null;
              literalText?: string|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ filter?: undefined; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "group"; group: anki.search.SearchNode.Group.$Shape; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "negated"; group?: null; negated: anki.search.SearchNode.$Shape; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "parsableText"; group?: null; negated?: null; parsableText: string; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "template"; group?: null; negated?: null; parsableText?: null; template: number; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "nid"; group?: null; negated?: null; parsableText?: null; template?: null; nid: number|Long; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "dupe"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe: anki.search.SearchNode.Dupe.$Shape; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "fieldName"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName: string; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "rated"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated: anki.search.SearchNode.Rated.$Shape; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "addedInDays"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays: number; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "dueInDays"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays: number; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "flag"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag: anki.search.SearchNode.Flag; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "cardState"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState: anki.search.SearchNode.CardState; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "nids"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids: anki.search.SearchNode.IdList.$Shape; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "editedInDays"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays: number; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "deck"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck: string; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "dueOnDay"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay: number; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "tag"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag: string; note?: null; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "note"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note: string; introducedInDays?: null; field?: null; literalText?: null }|{ filter?: "introducedInDays"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays: number; field?: null; literalText?: null }|{ filter?: "field"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field: anki.search.SearchNode.Field.$Shape; literalText?: null }|{ filter?: "literalText"; group?: null; negated?: null; parsableText?: null; template?: null; nid?: null; dupe?: null; fieldName?: null; rated?: null; addedInDays?: null; dueInDays?: null; flag?: null; cardState?: null; nids?: null; editedInDays?: null; deck?: null; dueOnDay?: null; tag?: null; note?: null; introducedInDays?: null; field?: null; literalText: string })
            );

            /** Flag enum. */
            enum Flag {

                /** FLAG_NONE value */
                FLAG_NONE = 0,

                /** FLAG_ANY value */
                FLAG_ANY = 1,

                /** FLAG_RED value */
                FLAG_RED = 2,

                /** FLAG_ORANGE value */
                FLAG_ORANGE = 3,

                /** FLAG_GREEN value */
                FLAG_GREEN = 4,

                /** FLAG_BLUE value */
                FLAG_BLUE = 5,

                /** FLAG_PINK value */
                FLAG_PINK = 6,

                /** FLAG_TURQUOISE value */
                FLAG_TURQUOISE = 7,

                /** FLAG_PURPLE value */
                FLAG_PURPLE = 8
            }

            /** Rating enum. */
            enum Rating {

                /** RATING_ANY value */
                RATING_ANY = 0,

                /** RATING_AGAIN value */
                RATING_AGAIN = 1,

                /** RATING_HARD value */
                RATING_HARD = 2,

                /** RATING_GOOD value */
                RATING_GOOD = 3,

                /** RATING_EASY value */
                RATING_EASY = 4,

                /** RATING_BY_RESCHEDULE value */
                RATING_BY_RESCHEDULE = 5
            }

            /** CardState enum. */
            enum CardState {

                /** CARD_STATE_NEW value */
                CARD_STATE_NEW = 0,

                /** CARD_STATE_LEARN value */
                CARD_STATE_LEARN = 1,

                /** CARD_STATE_REVIEW value */
                CARD_STATE_REVIEW = 2,

                /** CARD_STATE_DUE value */
                CARD_STATE_DUE = 3,

                /** CARD_STATE_SUSPENDED value */
                CARD_STATE_SUSPENDED = 4,

                /** CARD_STATE_BURIED value */
                CARD_STATE_BURIED = 5
            }

            /** FieldSearchMode enum. */
            enum FieldSearchMode {

                /** FIELD_SEARCH_MODE_NORMAL value */
                FIELD_SEARCH_MODE_NORMAL = 0,

                /** FIELD_SEARCH_MODE_REGEX value */
                FIELD_SEARCH_MODE_REGEX = 1,

                /** FIELD_SEARCH_MODE_NOCOMBINING value */
                FIELD_SEARCH_MODE_NOCOMBINING = 2
            }

            /**
             * Properties of a Dupe.
             * @deprecated Use anki.search.SearchNode.Dupe.$Properties instead.
             */
            interface IDupe extends anki.search.SearchNode.Dupe.$Properties {
            }

            /** Represents a Dupe. */
            class Dupe {

                /**
                 * Constructs a new Dupe.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SearchNode.Dupe.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Dupe notetypeId. */
                notetypeId: (number|Long);

                /** Dupe firstField. */
                firstField: string;

                /**
                 * Creates a new Dupe instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Dupe instance
                 */
                static create(properties: anki.search.SearchNode.Dupe.$Shape): anki.search.SearchNode.Dupe & anki.search.SearchNode.Dupe.$Shape;
                static create(properties?: anki.search.SearchNode.Dupe.$Properties): anki.search.SearchNode.Dupe;

                /**
                 * Encodes the specified Dupe message. Does not implicitly {@link anki.search.SearchNode.Dupe.verify|verify} messages.
                 * @param message Dupe message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SearchNode.Dupe.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Dupe message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SearchNode.Dupe & anki.search.SearchNode.Dupe.$Shape} Dupe
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode.Dupe & anki.search.SearchNode.Dupe.$Shape;
            }

            namespace Dupe {

                /** Properties of a Dupe. */
                interface $Properties {

                    /** Dupe notetypeId */
                    notetypeId?: (number|Long|null);

                    /** Dupe firstField */
                    firstField?: (string|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Dupe. */
                type $Shape = anki.search.SearchNode.Dupe.$Properties;
            }

            /**
             * Properties of a Rated.
             * @deprecated Use anki.search.SearchNode.Rated.$Properties instead.
             */
            interface IRated extends anki.search.SearchNode.Rated.$Properties {
            }

            /** Represents a Rated. */
            class Rated {

                /**
                 * Constructs a new Rated.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SearchNode.Rated.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Rated days. */
                days: number;

                /** Rated rating. */
                rating: anki.search.SearchNode.Rating;

                /**
                 * Creates a new Rated instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Rated instance
                 */
                static create(properties: anki.search.SearchNode.Rated.$Shape): anki.search.SearchNode.Rated & anki.search.SearchNode.Rated.$Shape;
                static create(properties?: anki.search.SearchNode.Rated.$Properties): anki.search.SearchNode.Rated;

                /**
                 * Encodes the specified Rated message. Does not implicitly {@link anki.search.SearchNode.Rated.verify|verify} messages.
                 * @param message Rated message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SearchNode.Rated.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Rated message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SearchNode.Rated & anki.search.SearchNode.Rated.$Shape} Rated
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode.Rated & anki.search.SearchNode.Rated.$Shape;
            }

            namespace Rated {

                /** Properties of a Rated. */
                interface $Properties {

                    /** Rated days */
                    days?: (number|null);

                    /** Rated rating */
                    rating?: (anki.search.SearchNode.Rating|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Rated. */
                type $Shape = anki.search.SearchNode.Rated.$Properties;
            }

            /**
             * Properties of an IdList.
             * @deprecated Use anki.search.SearchNode.IdList.$Properties instead.
             */
            interface IIdList extends anki.search.SearchNode.IdList.$Properties {
            }

            /** Represents an IdList. */
            class IdList {

                /**
                 * Constructs a new IdList.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SearchNode.IdList.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** IdList ids. */
                ids: (number|Long)[];

                /**
                 * Creates a new IdList instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns IdList instance
                 */
                static create(properties: anki.search.SearchNode.IdList.$Shape): anki.search.SearchNode.IdList & anki.search.SearchNode.IdList.$Shape;
                static create(properties?: anki.search.SearchNode.IdList.$Properties): anki.search.SearchNode.IdList;

                /**
                 * Encodes the specified IdList message. Does not implicitly {@link anki.search.SearchNode.IdList.verify|verify} messages.
                 * @param message IdList message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SearchNode.IdList.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an IdList message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SearchNode.IdList & anki.search.SearchNode.IdList.$Shape} IdList
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode.IdList & anki.search.SearchNode.IdList.$Shape;
            }

            namespace IdList {

                /** Properties of an IdList. */
                interface $Properties {

                    /** IdList ids */
                    ids?: ((number|Long)[]|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an IdList. */
                type $Shape = anki.search.SearchNode.IdList.$Properties;
            }

            /**
             * Properties of a Group.
             * @deprecated Use anki.search.SearchNode.Group.$Properties instead.
             */
            interface IGroup extends anki.search.SearchNode.Group.$Properties {
            }

            /** Represents a Group. */
            class Group {

                /**
                 * Constructs a new Group.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SearchNode.Group.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Group nodes. */
                nodes: anki.search.SearchNode.$Properties[];

                /** Group joiner. */
                joiner: anki.search.SearchNode.Group.Joiner;

                /**
                 * Creates a new Group instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Group instance
                 */
                static create(properties: anki.search.SearchNode.Group.$Shape): anki.search.SearchNode.Group & anki.search.SearchNode.Group.$Shape;
                static create(properties?: anki.search.SearchNode.Group.$Properties): anki.search.SearchNode.Group;

                /**
                 * Encodes the specified Group message. Does not implicitly {@link anki.search.SearchNode.Group.verify|verify} messages.
                 * @param message Group message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SearchNode.Group.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Group message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SearchNode.Group & anki.search.SearchNode.Group.$Shape} Group
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode.Group & anki.search.SearchNode.Group.$Shape;
            }

            namespace Group {

                /** Properties of a Group. */
                interface $Properties {

                    /** Group nodes */
                    nodes?: (anki.search.SearchNode.$Properties[]|null);

                    /** Group joiner */
                    joiner?: (anki.search.SearchNode.Group.Joiner|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Group. */
                type $Shape = {
                  nodes?: anki.search.SearchNode.$Shape[]|null;
                  joiner?: anki.search.SearchNode.Group.Joiner|null;
                  $unknowns?: Uint8Array[];
                };

                /** Joiner enum. */
                enum Joiner {

                    /** AND value */
                    AND = 0,

                    /** OR value */
                    OR = 1
                }
            }

            /**
             * Properties of a Field.
             * @deprecated Use anki.search.SearchNode.Field.$Properties instead.
             */
            interface IField extends anki.search.SearchNode.Field.$Properties {
            }

            /** Represents a Field. */
            class Field {

                /**
                 * Constructs a new Field.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SearchNode.Field.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Field fieldName. */
                fieldName: string;

                /** Field text. */
                text: string;

                /** Field mode. */
                mode: anki.search.SearchNode.FieldSearchMode;

                /**
                 * Creates a new Field instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Field instance
                 */
                static create(properties: anki.search.SearchNode.Field.$Shape): anki.search.SearchNode.Field & anki.search.SearchNode.Field.$Shape;
                static create(properties?: anki.search.SearchNode.Field.$Properties): anki.search.SearchNode.Field;

                /**
                 * Encodes the specified Field message. Does not implicitly {@link anki.search.SearchNode.Field.verify|verify} messages.
                 * @param message Field message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SearchNode.Field.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Field message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SearchNode.Field & anki.search.SearchNode.Field.$Shape} Field
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchNode.Field & anki.search.SearchNode.Field.$Shape;
            }

            namespace Field {

                /** Properties of a Field. */
                interface $Properties {

                    /** Field fieldName */
                    fieldName?: (string|null);

                    /** Field text */
                    text?: (string|null);

                    /** Field mode */
                    mode?: (anki.search.SearchNode.FieldSearchMode|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Field. */
                type $Shape = anki.search.SearchNode.Field.$Properties;
            }
        }

        /**
         * Properties of a SearchRequest.
         * @deprecated Use anki.search.SearchRequest.$Properties instead.
         */
        interface ISearchRequest extends anki.search.SearchRequest.$Properties {
        }

        /** Represents a SearchRequest. */
        class SearchRequest {

            /**
             * Constructs a new SearchRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.SearchRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SearchRequest search. */
            search: string;

            /** SearchRequest order. */
            order?: (anki.search.SortOrder.$Properties|null);

            /**
             * Creates a new SearchRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SearchRequest instance
             */
            static create(properties: anki.search.SearchRequest.$Shape): anki.search.SearchRequest & anki.search.SearchRequest.$Shape;
            static create(properties?: anki.search.SearchRequest.$Properties): anki.search.SearchRequest;

            /**
             * Encodes the specified SearchRequest message. Does not implicitly {@link anki.search.SearchRequest.verify|verify} messages.
             * @param message SearchRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.SearchRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SearchRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.SearchRequest & anki.search.SearchRequest.$Shape} SearchRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchRequest & anki.search.SearchRequest.$Shape;
        }

        namespace SearchRequest {

            /** Properties of a SearchRequest. */
            interface $Properties {

                /** SearchRequest search */
                search?: (string|null);

                /** SearchRequest order */
                order?: (anki.search.SortOrder.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SearchRequest. */
            type $Shape = {
              search?: string|null;
              order?: anki.search.SortOrder.$Shape|null;
              $unknowns?: Uint8Array[];
            };
        }

        /**
         * Properties of a SearchResponse.
         * @deprecated Use anki.search.SearchResponse.$Properties instead.
         */
        interface ISearchResponse extends anki.search.SearchResponse.$Properties {
        }

        /** Represents a SearchResponse. */
        class SearchResponse {

            /**
             * Constructs a new SearchResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.SearchResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SearchResponse ids. */
            ids: (number|Long)[];

            /**
             * Creates a new SearchResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SearchResponse instance
             */
            static create(properties: anki.search.SearchResponse.$Shape): anki.search.SearchResponse & anki.search.SearchResponse.$Shape;
            static create(properties?: anki.search.SearchResponse.$Properties): anki.search.SearchResponse;

            /**
             * Encodes the specified SearchResponse message. Does not implicitly {@link anki.search.SearchResponse.verify|verify} messages.
             * @param message SearchResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.SearchResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SearchResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.SearchResponse & anki.search.SearchResponse.$Shape} SearchResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SearchResponse & anki.search.SearchResponse.$Shape;
        }

        namespace SearchResponse {

            /** Properties of a SearchResponse. */
            interface $Properties {

                /** SearchResponse ids */
                ids?: ((number|Long)[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a SearchResponse. */
            type $Shape = anki.search.SearchResponse.$Properties;
        }

        /**
         * Properties of a SortOrder.
         * @deprecated Use anki.search.SortOrder.$Properties instead.
         */
        interface ISortOrder extends anki.search.SortOrder.$Properties {
        }

        /** Represents a SortOrder. */
        class SortOrder {

            /**
             * Constructs a new SortOrder.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.SortOrder.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** SortOrder none. */
            none?: (anki.generic.Empty.$Properties|null);

            /** SortOrder custom. */
            custom?: (string|null);

            /** SortOrder builtin. */
            builtin?: (anki.search.SortOrder.Builtin.$Properties|null);

            /** SortOrder value. */
            value?: ("none"|"custom"|"builtin");

            /**
             * Creates a new SortOrder instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SortOrder instance
             */
            static create(properties: anki.search.SortOrder.$Shape): anki.search.SortOrder & anki.search.SortOrder.$Shape;
            static create(properties?: anki.search.SortOrder.$Properties): anki.search.SortOrder;

            /**
             * Encodes the specified SortOrder message. Does not implicitly {@link anki.search.SortOrder.verify|verify} messages.
             * @param message SortOrder message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.SortOrder.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SortOrder message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.SortOrder & anki.search.SortOrder.$Shape} SortOrder
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SortOrder & anki.search.SortOrder.$Shape;
        }

        namespace SortOrder {

            /** Properties of a SortOrder. */
            interface $Properties {

                /** SortOrder none */
                none?: (anki.generic.Empty.$Properties|null);

                /** SortOrder custom */
                custom?: (string|null);

                /** SortOrder builtin */
                builtin?: (anki.search.SortOrder.Builtin.$Properties|null);

                /** SortOrder value */
                value?: ("none"|"custom"|"builtin");

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Narrowed shape of a SortOrder. */
            type $Shape = {
              none?: anki.generic.Empty.$Shape|null;
              custom?: string|null;
              builtin?: anki.search.SortOrder.Builtin.$Shape|null;
              $unknowns?: Uint8Array[];
            } & (
              ({ value?: undefined; none?: null; custom?: null; builtin?: null }|{ value?: "none"; none: anki.generic.Empty.$Shape; custom?: null; builtin?: null }|{ value?: "custom"; none?: null; custom: string; builtin?: null }|{ value?: "builtin"; none?: null; custom?: null; builtin: anki.search.SortOrder.Builtin.$Shape })
            );

            /**
             * Properties of a Builtin.
             * @deprecated Use anki.search.SortOrder.Builtin.$Properties instead.
             */
            interface IBuiltin extends anki.search.SortOrder.Builtin.$Properties {
            }

            /** Represents a Builtin. */
            class Builtin {

                /**
                 * Constructs a new Builtin.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.SortOrder.Builtin.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Builtin column. */
                column: string;

                /** Builtin reverse. */
                reverse: boolean;

                /**
                 * Creates a new Builtin instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Builtin instance
                 */
                static create(properties: anki.search.SortOrder.Builtin.$Shape): anki.search.SortOrder.Builtin & anki.search.SortOrder.Builtin.$Shape;
                static create(properties?: anki.search.SortOrder.Builtin.$Properties): anki.search.SortOrder.Builtin;

                /**
                 * Encodes the specified Builtin message. Does not implicitly {@link anki.search.SortOrder.Builtin.verify|verify} messages.
                 * @param message Builtin message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.SortOrder.Builtin.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Builtin message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.SortOrder.Builtin & anki.search.SortOrder.Builtin.$Shape} Builtin
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.SortOrder.Builtin & anki.search.SortOrder.Builtin.$Shape;
            }

            namespace Builtin {

                /** Properties of a Builtin. */
                interface $Properties {

                    /** Builtin column */
                    column?: (string|null);

                    /** Builtin reverse */
                    reverse?: (boolean|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Builtin. */
                type $Shape = anki.search.SortOrder.Builtin.$Properties;
            }
        }

        /**
         * Properties of a JoinSearchNodesRequest.
         * @deprecated Use anki.search.JoinSearchNodesRequest.$Properties instead.
         */
        interface IJoinSearchNodesRequest extends anki.search.JoinSearchNodesRequest.$Properties {
        }

        /** Represents a JoinSearchNodesRequest. */
        class JoinSearchNodesRequest {

            /**
             * Constructs a new JoinSearchNodesRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.JoinSearchNodesRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** JoinSearchNodesRequest joiner. */
            joiner: anki.search.SearchNode.Group.Joiner;

            /** JoinSearchNodesRequest existingNode. */
            existingNode?: (anki.search.SearchNode.$Properties|null);

            /** JoinSearchNodesRequest additionalNode. */
            additionalNode?: (anki.search.SearchNode.$Properties|null);

            /**
             * Creates a new JoinSearchNodesRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns JoinSearchNodesRequest instance
             */
            static create(properties: anki.search.JoinSearchNodesRequest.$Shape): anki.search.JoinSearchNodesRequest & anki.search.JoinSearchNodesRequest.$Shape;
            static create(properties?: anki.search.JoinSearchNodesRequest.$Properties): anki.search.JoinSearchNodesRequest;

            /**
             * Encodes the specified JoinSearchNodesRequest message. Does not implicitly {@link anki.search.JoinSearchNodesRequest.verify|verify} messages.
             * @param message JoinSearchNodesRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.JoinSearchNodesRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a JoinSearchNodesRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.JoinSearchNodesRequest & anki.search.JoinSearchNodesRequest.$Shape} JoinSearchNodesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.JoinSearchNodesRequest & anki.search.JoinSearchNodesRequest.$Shape;
        }

        namespace JoinSearchNodesRequest {

            /** Properties of a JoinSearchNodesRequest. */
            interface $Properties {

                /** JoinSearchNodesRequest joiner */
                joiner?: (anki.search.SearchNode.Group.Joiner|null);

                /** JoinSearchNodesRequest existingNode */
                existingNode?: (anki.search.SearchNode.$Properties|null);

                /** JoinSearchNodesRequest additionalNode */
                additionalNode?: (anki.search.SearchNode.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a JoinSearchNodesRequest. */
            type $Shape = {
              joiner?: anki.search.SearchNode.Group.Joiner|null;
              existingNode?: anki.search.SearchNode.$Shape|null;
              additionalNode?: anki.search.SearchNode.$Shape|null;
              $unknowns?: Uint8Array[];
            };
        }

        /**
         * Properties of a FindAndReplaceRequest.
         * @deprecated Use anki.search.FindAndReplaceRequest.$Properties instead.
         */
        interface IFindAndReplaceRequest extends anki.search.FindAndReplaceRequest.$Properties {
        }

        /** Represents a FindAndReplaceRequest. */
        class FindAndReplaceRequest {

            /**
             * Constructs a new FindAndReplaceRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.FindAndReplaceRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FindAndReplaceRequest nids. */
            nids: (number|Long)[];

            /** FindAndReplaceRequest search. */
            search: string;

            /** FindAndReplaceRequest replacement. */
            replacement: string;

            /** FindAndReplaceRequest regex. */
            regex: boolean;

            /** FindAndReplaceRequest matchCase. */
            matchCase: boolean;

            /** FindAndReplaceRequest fieldName. */
            fieldName: string;

            /**
             * Creates a new FindAndReplaceRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FindAndReplaceRequest instance
             */
            static create(properties: anki.search.FindAndReplaceRequest.$Shape): anki.search.FindAndReplaceRequest & anki.search.FindAndReplaceRequest.$Shape;
            static create(properties?: anki.search.FindAndReplaceRequest.$Properties): anki.search.FindAndReplaceRequest;

            /**
             * Encodes the specified FindAndReplaceRequest message. Does not implicitly {@link anki.search.FindAndReplaceRequest.verify|verify} messages.
             * @param message FindAndReplaceRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.FindAndReplaceRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FindAndReplaceRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.FindAndReplaceRequest & anki.search.FindAndReplaceRequest.$Shape} FindAndReplaceRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.FindAndReplaceRequest & anki.search.FindAndReplaceRequest.$Shape;
        }

        namespace FindAndReplaceRequest {

            /** Properties of a FindAndReplaceRequest. */
            interface $Properties {

                /** FindAndReplaceRequest nids */
                nids?: ((number|Long)[]|null);

                /** FindAndReplaceRequest search */
                search?: (string|null);

                /** FindAndReplaceRequest replacement */
                replacement?: (string|null);

                /** FindAndReplaceRequest regex */
                regex?: (boolean|null);

                /** FindAndReplaceRequest matchCase */
                matchCase?: (boolean|null);

                /** FindAndReplaceRequest fieldName */
                fieldName?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FindAndReplaceRequest. */
            type $Shape = anki.search.FindAndReplaceRequest.$Properties;
        }

        /**
         * Properties of a BrowserColumns.
         * @deprecated Use anki.search.BrowserColumns.$Properties instead.
         */
        interface IBrowserColumns extends anki.search.BrowserColumns.$Properties {
        }

        /** Represents a BrowserColumns. */
        class BrowserColumns {

            /**
             * Constructs a new BrowserColumns.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.BrowserColumns.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** BrowserColumns columns. */
            columns: anki.search.BrowserColumns.Column.$Properties[];

            /**
             * Creates a new BrowserColumns instance using the specified properties.
             * @param [properties] Properties to set
             * @returns BrowserColumns instance
             */
            static create(properties: anki.search.BrowserColumns.$Shape): anki.search.BrowserColumns & anki.search.BrowserColumns.$Shape;
            static create(properties?: anki.search.BrowserColumns.$Properties): anki.search.BrowserColumns;

            /**
             * Encodes the specified BrowserColumns message. Does not implicitly {@link anki.search.BrowserColumns.verify|verify} messages.
             * @param message BrowserColumns message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.BrowserColumns.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a BrowserColumns message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.BrowserColumns & anki.search.BrowserColumns.$Shape} BrowserColumns
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.BrowserColumns & anki.search.BrowserColumns.$Shape;
        }

        namespace BrowserColumns {

            /** Properties of a BrowserColumns. */
            interface $Properties {

                /** BrowserColumns columns */
                columns?: (anki.search.BrowserColumns.Column.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a BrowserColumns. */
            type $Shape = anki.search.BrowserColumns.$Properties;

            /** Sorting enum. */
            enum Sorting {

                /** SORTING_NONE value */
                SORTING_NONE = 0,

                /** SORTING_ASCENDING value */
                SORTING_ASCENDING = 1,

                /** SORTING_DESCENDING value */
                SORTING_DESCENDING = 2
            }

            /** Alignment enum. */
            enum Alignment {

                /** ALIGNMENT_START value */
                ALIGNMENT_START = 0,

                /** ALIGNMENT_CENTER value */
                ALIGNMENT_CENTER = 1
            }

            /**
             * Properties of a Column.
             * @deprecated Use anki.search.BrowserColumns.Column.$Properties instead.
             */
            interface IColumn extends anki.search.BrowserColumns.Column.$Properties {
            }

            /** Represents a Column. */
            class Column {

                /**
                 * Constructs a new Column.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.BrowserColumns.Column.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Column key. */
                key: string;

                /** Column cardsModeLabel. */
                cardsModeLabel: string;

                /** Column notesModeLabel. */
                notesModeLabel: string;

                /** Column sortingCards. */
                sortingCards: anki.search.BrowserColumns.Sorting;

                /** Column sortingNotes. */
                sortingNotes: anki.search.BrowserColumns.Sorting;

                /** Column usesCellFont. */
                usesCellFont: boolean;

                /** Column alignment. */
                alignment: anki.search.BrowserColumns.Alignment;

                /** Column cardsModeTooltip. */
                cardsModeTooltip: string;

                /** Column notesModeTooltip. */
                notesModeTooltip: string;

                /**
                 * Creates a new Column instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Column instance
                 */
                static create(properties: anki.search.BrowserColumns.Column.$Shape): anki.search.BrowserColumns.Column & anki.search.BrowserColumns.Column.$Shape;
                static create(properties?: anki.search.BrowserColumns.Column.$Properties): anki.search.BrowserColumns.Column;

                /**
                 * Encodes the specified Column message. Does not implicitly {@link anki.search.BrowserColumns.Column.verify|verify} messages.
                 * @param message Column message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.BrowserColumns.Column.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Column message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.BrowserColumns.Column & anki.search.BrowserColumns.Column.$Shape} Column
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.BrowserColumns.Column & anki.search.BrowserColumns.Column.$Shape;
            }

            namespace Column {

                /** Properties of a Column. */
                interface $Properties {

                    /** Column key */
                    key?: (string|null);

                    /** Column cardsModeLabel */
                    cardsModeLabel?: (string|null);

                    /** Column notesModeLabel */
                    notesModeLabel?: (string|null);

                    /** Column sortingCards */
                    sortingCards?: (anki.search.BrowserColumns.Sorting|null);

                    /** Column sortingNotes */
                    sortingNotes?: (anki.search.BrowserColumns.Sorting|null);

                    /** Column usesCellFont */
                    usesCellFont?: (boolean|null);

                    /** Column alignment */
                    alignment?: (anki.search.BrowserColumns.Alignment|null);

                    /** Column cardsModeTooltip */
                    cardsModeTooltip?: (string|null);

                    /** Column notesModeTooltip */
                    notesModeTooltip?: (string|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Column. */
                type $Shape = anki.search.BrowserColumns.Column.$Properties;
            }
        }

        /**
         * Properties of a BrowserRow.
         * @deprecated Use anki.search.BrowserRow.$Properties instead.
         */
        interface IBrowserRow extends anki.search.BrowserRow.$Properties {
        }

        /** Represents a BrowserRow. */
        class BrowserRow {

            /**
             * Constructs a new BrowserRow.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.search.BrowserRow.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** BrowserRow cells. */
            cells: anki.search.BrowserRow.Cell.$Properties[];

            /** BrowserRow color. */
            color: anki.search.BrowserRow.Color;

            /** BrowserRow fontName. */
            fontName: string;

            /** BrowserRow fontSize. */
            fontSize: number;

            /**
             * Creates a new BrowserRow instance using the specified properties.
             * @param [properties] Properties to set
             * @returns BrowserRow instance
             */
            static create(properties: anki.search.BrowserRow.$Shape): anki.search.BrowserRow & anki.search.BrowserRow.$Shape;
            static create(properties?: anki.search.BrowserRow.$Properties): anki.search.BrowserRow;

            /**
             * Encodes the specified BrowserRow message. Does not implicitly {@link anki.search.BrowserRow.verify|verify} messages.
             * @param message BrowserRow message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.search.BrowserRow.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a BrowserRow message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.search.BrowserRow & anki.search.BrowserRow.$Shape} BrowserRow
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.BrowserRow & anki.search.BrowserRow.$Shape;
        }

        namespace BrowserRow {

            /** Properties of a BrowserRow. */
            interface $Properties {

                /** BrowserRow cells */
                cells?: (anki.search.BrowserRow.Cell.$Properties[]|null);

                /** BrowserRow color */
                color?: (anki.search.BrowserRow.Color|null);

                /** BrowserRow fontName */
                fontName?: (string|null);

                /** BrowserRow fontSize */
                fontSize?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a BrowserRow. */
            type $Shape = anki.search.BrowserRow.$Properties;

            /** Color enum. */
            enum Color {

                /** COLOR_DEFAULT value */
                COLOR_DEFAULT = 0,

                /** COLOR_MARKED value */
                COLOR_MARKED = 1,

                /** COLOR_SUSPENDED value */
                COLOR_SUSPENDED = 2,

                /** COLOR_FLAG_RED value */
                COLOR_FLAG_RED = 3,

                /** COLOR_FLAG_ORANGE value */
                COLOR_FLAG_ORANGE = 4,

                /** COLOR_FLAG_GREEN value */
                COLOR_FLAG_GREEN = 5,

                /** COLOR_FLAG_BLUE value */
                COLOR_FLAG_BLUE = 6,

                /** COLOR_FLAG_PINK value */
                COLOR_FLAG_PINK = 7,

                /** COLOR_FLAG_TURQUOISE value */
                COLOR_FLAG_TURQUOISE = 8,

                /** COLOR_FLAG_PURPLE value */
                COLOR_FLAG_PURPLE = 9,

                /** COLOR_BURIED value */
                COLOR_BURIED = 10
            }

            /**
             * Properties of a Cell.
             * @deprecated Use anki.search.BrowserRow.Cell.$Properties instead.
             */
            interface ICell extends anki.search.BrowserRow.Cell.$Properties {
            }

            /** Represents a Cell. */
            class Cell {

                /**
                 * Constructs a new Cell.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.search.BrowserRow.Cell.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Cell text. */
                text: string;

                /** Cell isRtl. */
                isRtl: boolean;

                /** Cell elideMode. */
                elideMode: anki.search.BrowserRow.Cell.TextElideMode;

                /**
                 * Creates a new Cell instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Cell instance
                 */
                static create(properties: anki.search.BrowserRow.Cell.$Shape): anki.search.BrowserRow.Cell & anki.search.BrowserRow.Cell.$Shape;
                static create(properties?: anki.search.BrowserRow.Cell.$Properties): anki.search.BrowserRow.Cell;

                /**
                 * Encodes the specified Cell message. Does not implicitly {@link anki.search.BrowserRow.Cell.verify|verify} messages.
                 * @param message Cell message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.search.BrowserRow.Cell.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Cell message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.search.BrowserRow.Cell & anki.search.BrowserRow.Cell.$Shape} Cell
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.search.BrowserRow.Cell & anki.search.BrowserRow.Cell.$Shape;
            }

            namespace Cell {

                /** Properties of a Cell. */
                interface $Properties {

                    /** Cell text */
                    text?: (string|null);

                    /** Cell isRtl */
                    isRtl?: (boolean|null);

                    /** Cell elideMode */
                    elideMode?: (anki.search.BrowserRow.Cell.TextElideMode|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Cell. */
                type $Shape = anki.search.BrowserRow.Cell.$Properties;

                /** TextElideMode enum. */
                enum TextElideMode {

                    /** ElideLeft value */
                    ElideLeft = 0,

                    /** ElideRight value */
                    ElideRight = 1,

                    /** ElideMiddle value */
                    ElideMiddle = 2,

                    /** ElideNone value */
                    ElideNone = 3
                }
            }
        }
    }

    /** Namespace stats. */
    namespace stats {

        /**
         * Properties of a ReviewLogs.
         * @deprecated Use anki.stats.ReviewLogs.$Properties instead.
         */
        interface IReviewLogs extends anki.stats.ReviewLogs.$Properties {
        }

        /** Represents a ReviewLogs. */
        class ReviewLogs {

            /**
             * Constructs a new ReviewLogs.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.ReviewLogs.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ReviewLogs entries. */
            entries: anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties[];

            /**
             * Creates a new ReviewLogs instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ReviewLogs instance
             */
            static create(properties: anki.stats.ReviewLogs.$Shape): anki.stats.ReviewLogs & anki.stats.ReviewLogs.$Shape;
            static create(properties?: anki.stats.ReviewLogs.$Properties): anki.stats.ReviewLogs;

            /**
             * Encodes the specified ReviewLogs message. Does not implicitly {@link anki.stats.ReviewLogs.verify|verify} messages.
             * @param message ReviewLogs message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.ReviewLogs.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ReviewLogs message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.ReviewLogs & anki.stats.ReviewLogs.$Shape} ReviewLogs
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.ReviewLogs & anki.stats.ReviewLogs.$Shape;
        }

        namespace ReviewLogs {

            /** Properties of a ReviewLogs. */
            interface $Properties {

                /** ReviewLogs entries */
                entries?: (anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ReviewLogs. */
            type $Shape = anki.stats.ReviewLogs.$Properties;
        }

        /**
         * Properties of a CardStatsResponse.
         * @deprecated Use anki.stats.CardStatsResponse.$Properties instead.
         */
        interface ICardStatsResponse extends anki.stats.CardStatsResponse.$Properties {
        }

        /** Represents a CardStatsResponse. */
        class CardStatsResponse {

            /**
             * Constructs a new CardStatsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.CardStatsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CardStatsResponse revlog. */
            revlog: anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties[];

            /** CardStatsResponse cardId. */
            cardId: (number|Long);

            /** CardStatsResponse noteId. */
            noteId: (number|Long);

            /** CardStatsResponse deck. */
            deck: string;

            /** CardStatsResponse added. */
            added: (number|Long);

            /** CardStatsResponse firstReview. */
            firstReview?: (number|Long|null);

            /** CardStatsResponse latestReview. */
            latestReview?: (number|Long|null);

            /** CardStatsResponse dueDate. */
            dueDate?: (number|Long|null);

            /** CardStatsResponse duePosition. */
            duePosition?: (number|null);

            /** CardStatsResponse interval. */
            interval: number;

            /** CardStatsResponse ease. */
            ease: number;

            /** CardStatsResponse reviews. */
            reviews: number;

            /** CardStatsResponse lapses. */
            lapses: number;

            /** CardStatsResponse averageSecs. */
            averageSecs: number;

            /** CardStatsResponse totalSecs. */
            totalSecs: number;

            /** CardStatsResponse cardType. */
            cardType: string;

            /** CardStatsResponse notetype. */
            notetype: string;

            /** CardStatsResponse memoryState. */
            memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

            /** CardStatsResponse fsrsRetrievability. */
            fsrsRetrievability?: (number|null);

            /** CardStatsResponse customData. */
            customData: string;

            /** CardStatsResponse preset. */
            preset: string;

            /** CardStatsResponse originalDeck. */
            originalDeck?: (string|null);

            /** CardStatsResponse desiredRetention. */
            desiredRetention?: (number|null);

            /** CardStatsResponse fsrsParams. */
            fsrsParams: number[];

            /**
             * Creates a new CardStatsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CardStatsResponse instance
             */
            static create(properties: anki.stats.CardStatsResponse.$Shape): anki.stats.CardStatsResponse & anki.stats.CardStatsResponse.$Shape;
            static create(properties?: anki.stats.CardStatsResponse.$Properties): anki.stats.CardStatsResponse;

            /**
             * Encodes the specified CardStatsResponse message. Does not implicitly {@link anki.stats.CardStatsResponse.verify|verify} messages.
             * @param message CardStatsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.CardStatsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CardStatsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.CardStatsResponse & anki.stats.CardStatsResponse.$Shape} CardStatsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.CardStatsResponse & anki.stats.CardStatsResponse.$Shape;
        }

        namespace CardStatsResponse {

            /** Properties of a CardStatsResponse. */
            interface $Properties {

                /** CardStatsResponse revlog */
                revlog?: (anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties[]|null);

                /** CardStatsResponse cardId */
                cardId?: (number|Long|null);

                /** CardStatsResponse noteId */
                noteId?: (number|Long|null);

                /** CardStatsResponse deck */
                deck?: (string|null);

                /** CardStatsResponse added */
                added?: (number|Long|null);

                /** CardStatsResponse firstReview */
                firstReview?: (number|Long|null);

                /** CardStatsResponse latestReview */
                latestReview?: (number|Long|null);

                /** CardStatsResponse dueDate */
                dueDate?: (number|Long|null);

                /** CardStatsResponse duePosition */
                duePosition?: (number|null);

                /** CardStatsResponse interval */
                interval?: (number|null);

                /** CardStatsResponse ease */
                ease?: (number|null);

                /** CardStatsResponse reviews */
                reviews?: (number|null);

                /** CardStatsResponse lapses */
                lapses?: (number|null);

                /** CardStatsResponse averageSecs */
                averageSecs?: (number|null);

                /** CardStatsResponse totalSecs */
                totalSecs?: (number|null);

                /** CardStatsResponse cardType */
                cardType?: (string|null);

                /** CardStatsResponse notetype */
                notetype?: (string|null);

                /** CardStatsResponse memoryState */
                memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                /** CardStatsResponse fsrsRetrievability */
                fsrsRetrievability?: (number|null);

                /** CardStatsResponse customData */
                customData?: (string|null);

                /** CardStatsResponse preset */
                preset?: (string|null);

                /** CardStatsResponse originalDeck */
                originalDeck?: (string|null);

                /** CardStatsResponse desiredRetention */
                desiredRetention?: (number|null);

                /** CardStatsResponse fsrsParams */
                fsrsParams?: (number[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CardStatsResponse. */
            type $Shape = anki.stats.CardStatsResponse.$Properties;

            /**
             * Properties of a StatsRevlogEntry.
             * @deprecated Use anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties instead.
             */
            interface IStatsRevlogEntry extends anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties {
            }

            /** Represents a StatsRevlogEntry. */
            class StatsRevlogEntry {

                /**
                 * Constructs a new StatsRevlogEntry.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** StatsRevlogEntry time. */
                time: (number|Long);

                /** StatsRevlogEntry reviewKind. */
                reviewKind: anki.stats.RevlogEntry.ReviewKind;

                /** StatsRevlogEntry buttonChosen. */
                buttonChosen: number;

                /** StatsRevlogEntry interval. */
                interval: number;

                /** StatsRevlogEntry ease. */
                ease: number;

                /** StatsRevlogEntry takenSecs. */
                takenSecs: number;

                /** StatsRevlogEntry memoryState. */
                memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                /** StatsRevlogEntry lastInterval. */
                lastInterval: number;

                /**
                 * Creates a new StatsRevlogEntry instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns StatsRevlogEntry instance
                 */
                static create(properties: anki.stats.CardStatsResponse.StatsRevlogEntry.$Shape): anki.stats.CardStatsResponse.StatsRevlogEntry & anki.stats.CardStatsResponse.StatsRevlogEntry.$Shape;
                static create(properties?: anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties): anki.stats.CardStatsResponse.StatsRevlogEntry;

                /**
                 * Encodes the specified StatsRevlogEntry message. Does not implicitly {@link anki.stats.CardStatsResponse.StatsRevlogEntry.verify|verify} messages.
                 * @param message StatsRevlogEntry message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a StatsRevlogEntry message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.CardStatsResponse.StatsRevlogEntry & anki.stats.CardStatsResponse.StatsRevlogEntry.$Shape} StatsRevlogEntry
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.CardStatsResponse.StatsRevlogEntry & anki.stats.CardStatsResponse.StatsRevlogEntry.$Shape;
            }

            namespace StatsRevlogEntry {

                /** Properties of a StatsRevlogEntry. */
                interface $Properties {

                    /** StatsRevlogEntry time */
                    time?: (number|Long|null);

                    /** StatsRevlogEntry reviewKind */
                    reviewKind?: (anki.stats.RevlogEntry.ReviewKind|null);

                    /** StatsRevlogEntry buttonChosen */
                    buttonChosen?: (number|null);

                    /** StatsRevlogEntry interval */
                    interval?: (number|null);

                    /** StatsRevlogEntry ease */
                    ease?: (number|null);

                    /** StatsRevlogEntry takenSecs */
                    takenSecs?: (number|null);

                    /** StatsRevlogEntry memoryState */
                    memoryState?: (anki.cards.FsrsMemoryState.$Properties|null);

                    /** StatsRevlogEntry lastInterval */
                    lastInterval?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a StatsRevlogEntry. */
                type $Shape = anki.stats.CardStatsResponse.StatsRevlogEntry.$Properties;
            }
        }

        /**
         * Properties of a GraphsRequest.
         * @deprecated Use anki.stats.GraphsRequest.$Properties instead.
         */
        interface IGraphsRequest extends anki.stats.GraphsRequest.$Properties {
        }

        /** Represents a GraphsRequest. */
        class GraphsRequest {

            /**
             * Constructs a new GraphsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.GraphsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GraphsRequest search. */
            search: string;

            /** GraphsRequest days. */
            days: number;

            /**
             * Creates a new GraphsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GraphsRequest instance
             */
            static create(properties: anki.stats.GraphsRequest.$Shape): anki.stats.GraphsRequest & anki.stats.GraphsRequest.$Shape;
            static create(properties?: anki.stats.GraphsRequest.$Properties): anki.stats.GraphsRequest;

            /**
             * Encodes the specified GraphsRequest message. Does not implicitly {@link anki.stats.GraphsRequest.verify|verify} messages.
             * @param message GraphsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.GraphsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GraphsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.GraphsRequest & anki.stats.GraphsRequest.$Shape} GraphsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsRequest & anki.stats.GraphsRequest.$Shape;
        }

        namespace GraphsRequest {

            /** Properties of a GraphsRequest. */
            interface $Properties {

                /** GraphsRequest search */
                search?: (string|null);

                /** GraphsRequest days */
                days?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GraphsRequest. */
            type $Shape = anki.stats.GraphsRequest.$Properties;
        }

        /**
         * Properties of a GraphsResponse.
         * @deprecated Use anki.stats.GraphsResponse.$Properties instead.
         */
        interface IGraphsResponse extends anki.stats.GraphsResponse.$Properties {
        }

        /** Represents a GraphsResponse. */
        class GraphsResponse {

            /**
             * Constructs a new GraphsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.GraphsResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GraphsResponse buttons. */
            buttons?: (anki.stats.GraphsResponse.Buttons.$Properties|null);

            /** GraphsResponse cardCounts. */
            cardCounts?: (anki.stats.GraphsResponse.CardCounts.$Properties|null);

            /** GraphsResponse hours. */
            hours?: (anki.stats.GraphsResponse.Hours.$Properties|null);

            /** GraphsResponse today. */
            today?: (anki.stats.GraphsResponse.Today.$Properties|null);

            /** GraphsResponse eases. */
            eases?: (anki.stats.GraphsResponse.Eases.$Properties|null);

            /** GraphsResponse difficulty. */
            difficulty?: (anki.stats.GraphsResponse.Eases.$Properties|null);

            /** GraphsResponse intervals. */
            intervals?: (anki.stats.GraphsResponse.Intervals.$Properties|null);

            /** GraphsResponse futureDue. */
            futureDue?: (anki.stats.GraphsResponse.FutureDue.$Properties|null);

            /** GraphsResponse added. */
            added?: (anki.stats.GraphsResponse.Added.$Properties|null);

            /** GraphsResponse reviews. */
            reviews?: (anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties|null);

            /** GraphsResponse rolloverHour. */
            rolloverHour: number;

            /** GraphsResponse retrievability. */
            retrievability?: (anki.stats.GraphsResponse.Retrievability.$Properties|null);

            /** GraphsResponse fsrs. */
            fsrs: boolean;

            /** GraphsResponse stability. */
            stability?: (anki.stats.GraphsResponse.Intervals.$Properties|null);

            /** GraphsResponse trueRetention. */
            trueRetention?: (anki.stats.GraphsResponse.TrueRetentionStats.$Properties|null);

            /**
             * Creates a new GraphsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GraphsResponse instance
             */
            static create(properties: anki.stats.GraphsResponse.$Shape): anki.stats.GraphsResponse & anki.stats.GraphsResponse.$Shape;
            static create(properties?: anki.stats.GraphsResponse.$Properties): anki.stats.GraphsResponse;

            /**
             * Encodes the specified GraphsResponse message. Does not implicitly {@link anki.stats.GraphsResponse.verify|verify} messages.
             * @param message GraphsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.GraphsResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GraphsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.GraphsResponse & anki.stats.GraphsResponse.$Shape} GraphsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse & anki.stats.GraphsResponse.$Shape;
        }

        namespace GraphsResponse {

            /** Properties of a GraphsResponse. */
            interface $Properties {

                /** GraphsResponse buttons */
                buttons?: (anki.stats.GraphsResponse.Buttons.$Properties|null);

                /** GraphsResponse cardCounts */
                cardCounts?: (anki.stats.GraphsResponse.CardCounts.$Properties|null);

                /** GraphsResponse hours */
                hours?: (anki.stats.GraphsResponse.Hours.$Properties|null);

                /** GraphsResponse today */
                today?: (anki.stats.GraphsResponse.Today.$Properties|null);

                /** GraphsResponse eases */
                eases?: (anki.stats.GraphsResponse.Eases.$Properties|null);

                /** GraphsResponse difficulty */
                difficulty?: (anki.stats.GraphsResponse.Eases.$Properties|null);

                /** GraphsResponse intervals */
                intervals?: (anki.stats.GraphsResponse.Intervals.$Properties|null);

                /** GraphsResponse futureDue */
                futureDue?: (anki.stats.GraphsResponse.FutureDue.$Properties|null);

                /** GraphsResponse added */
                added?: (anki.stats.GraphsResponse.Added.$Properties|null);

                /** GraphsResponse reviews */
                reviews?: (anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties|null);

                /** GraphsResponse rolloverHour */
                rolloverHour?: (number|null);

                /** GraphsResponse retrievability */
                retrievability?: (anki.stats.GraphsResponse.Retrievability.$Properties|null);

                /** GraphsResponse fsrs */
                fsrs?: (boolean|null);

                /** GraphsResponse stability */
                stability?: (anki.stats.GraphsResponse.Intervals.$Properties|null);

                /** GraphsResponse trueRetention */
                trueRetention?: (anki.stats.GraphsResponse.TrueRetentionStats.$Properties|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GraphsResponse. */
            type $Shape = anki.stats.GraphsResponse.$Properties;

            /**
             * Properties of an Added.
             * @deprecated Use anki.stats.GraphsResponse.Added.$Properties instead.
             */
            interface IAdded extends anki.stats.GraphsResponse.Added.$Properties {
            }

            /** Represents an Added. */
            class Added {

                /**
                 * Constructs a new Added.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Added.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Added added. */
                added: { [k: string]: number };

                /**
                 * Creates a new Added instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Added instance
                 */
                static create(properties: anki.stats.GraphsResponse.Added.$Shape): anki.stats.GraphsResponse.Added & anki.stats.GraphsResponse.Added.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Added.$Properties): anki.stats.GraphsResponse.Added;

                /**
                 * Encodes the specified Added message. Does not implicitly {@link anki.stats.GraphsResponse.Added.verify|verify} messages.
                 * @param message Added message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Added.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Added message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Added & anki.stats.GraphsResponse.Added.$Shape} Added
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Added & anki.stats.GraphsResponse.Added.$Shape;
            }

            namespace Added {

                /** Properties of an Added. */
                interface $Properties {

                    /** Added added */
                    added?: ({ [k: string]: number }|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an Added. */
                type $Shape = anki.stats.GraphsResponse.Added.$Properties;
            }

            /**
             * Properties of an Intervals.
             * @deprecated Use anki.stats.GraphsResponse.Intervals.$Properties instead.
             */
            interface IIntervals extends anki.stats.GraphsResponse.Intervals.$Properties {
            }

            /** Represents an Intervals. */
            class Intervals {

                /**
                 * Constructs a new Intervals.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Intervals.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Intervals intervals. */
                intervals: { [k: string]: number };

                /**
                 * Creates a new Intervals instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Intervals instance
                 */
                static create(properties: anki.stats.GraphsResponse.Intervals.$Shape): anki.stats.GraphsResponse.Intervals & anki.stats.GraphsResponse.Intervals.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Intervals.$Properties): anki.stats.GraphsResponse.Intervals;

                /**
                 * Encodes the specified Intervals message. Does not implicitly {@link anki.stats.GraphsResponse.Intervals.verify|verify} messages.
                 * @param message Intervals message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Intervals.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Intervals message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Intervals & anki.stats.GraphsResponse.Intervals.$Shape} Intervals
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Intervals & anki.stats.GraphsResponse.Intervals.$Shape;
            }

            namespace Intervals {

                /** Properties of an Intervals. */
                interface $Properties {

                    /** Intervals intervals */
                    intervals?: ({ [k: string]: number }|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an Intervals. */
                type $Shape = anki.stats.GraphsResponse.Intervals.$Properties;
            }

            /**
             * Properties of an Eases.
             * @deprecated Use anki.stats.GraphsResponse.Eases.$Properties instead.
             */
            interface IEases extends anki.stats.GraphsResponse.Eases.$Properties {
            }

            /** Represents an Eases. */
            class Eases {

                /**
                 * Constructs a new Eases.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Eases.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Eases eases. */
                eases: { [k: string]: number };

                /** Eases average. */
                average: number;

                /**
                 * Creates a new Eases instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Eases instance
                 */
                static create(properties: anki.stats.GraphsResponse.Eases.$Shape): anki.stats.GraphsResponse.Eases & anki.stats.GraphsResponse.Eases.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Eases.$Properties): anki.stats.GraphsResponse.Eases;

                /**
                 * Encodes the specified Eases message. Does not implicitly {@link anki.stats.GraphsResponse.Eases.verify|verify} messages.
                 * @param message Eases message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Eases.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Eases message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Eases & anki.stats.GraphsResponse.Eases.$Shape} Eases
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Eases & anki.stats.GraphsResponse.Eases.$Shape;
            }

            namespace Eases {

                /** Properties of an Eases. */
                interface $Properties {

                    /** Eases eases */
                    eases?: ({ [k: string]: number }|null);

                    /** Eases average */
                    average?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an Eases. */
                type $Shape = anki.stats.GraphsResponse.Eases.$Properties;
            }

            /**
             * Properties of a Retrievability.
             * @deprecated Use anki.stats.GraphsResponse.Retrievability.$Properties instead.
             */
            interface IRetrievability extends anki.stats.GraphsResponse.Retrievability.$Properties {
            }

            /** Represents a Retrievability. */
            class Retrievability {

                /**
                 * Constructs a new Retrievability.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Retrievability.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Retrievability retrievability. */
                retrievability: { [k: string]: number };

                /** Retrievability average. */
                average: number;

                /** Retrievability sumByCard. */
                sumByCard: number;

                /** Retrievability sumByNote. */
                sumByNote: number;

                /**
                 * Creates a new Retrievability instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Retrievability instance
                 */
                static create(properties: anki.stats.GraphsResponse.Retrievability.$Shape): anki.stats.GraphsResponse.Retrievability & anki.stats.GraphsResponse.Retrievability.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Retrievability.$Properties): anki.stats.GraphsResponse.Retrievability;

                /**
                 * Encodes the specified Retrievability message. Does not implicitly {@link anki.stats.GraphsResponse.Retrievability.verify|verify} messages.
                 * @param message Retrievability message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Retrievability.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Retrievability message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Retrievability & anki.stats.GraphsResponse.Retrievability.$Shape} Retrievability
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Retrievability & anki.stats.GraphsResponse.Retrievability.$Shape;
            }

            namespace Retrievability {

                /** Properties of a Retrievability. */
                interface $Properties {

                    /** Retrievability retrievability */
                    retrievability?: ({ [k: string]: number }|null);

                    /** Retrievability average */
                    average?: (number|null);

                    /** Retrievability sumByCard */
                    sumByCard?: (number|null);

                    /** Retrievability sumByNote */
                    sumByNote?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Retrievability. */
                type $Shape = anki.stats.GraphsResponse.Retrievability.$Properties;
            }

            /**
             * Properties of a FutureDue.
             * @deprecated Use anki.stats.GraphsResponse.FutureDue.$Properties instead.
             */
            interface IFutureDue extends anki.stats.GraphsResponse.FutureDue.$Properties {
            }

            /** Represents a FutureDue. */
            class FutureDue {

                /**
                 * Constructs a new FutureDue.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.FutureDue.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** FutureDue futureDue. */
                futureDue: { [k: string]: number };

                /** FutureDue haveBacklog. */
                haveBacklog: boolean;

                /** FutureDue dailyLoad. */
                dailyLoad: number;

                /**
                 * Creates a new FutureDue instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns FutureDue instance
                 */
                static create(properties: anki.stats.GraphsResponse.FutureDue.$Shape): anki.stats.GraphsResponse.FutureDue & anki.stats.GraphsResponse.FutureDue.$Shape;
                static create(properties?: anki.stats.GraphsResponse.FutureDue.$Properties): anki.stats.GraphsResponse.FutureDue;

                /**
                 * Encodes the specified FutureDue message. Does not implicitly {@link anki.stats.GraphsResponse.FutureDue.verify|verify} messages.
                 * @param message FutureDue message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.FutureDue.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a FutureDue message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.FutureDue & anki.stats.GraphsResponse.FutureDue.$Shape} FutureDue
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.FutureDue & anki.stats.GraphsResponse.FutureDue.$Shape;
            }

            namespace FutureDue {

                /** Properties of a FutureDue. */
                interface $Properties {

                    /** FutureDue futureDue */
                    futureDue?: ({ [k: string]: number }|null);

                    /** FutureDue haveBacklog */
                    haveBacklog?: (boolean|null);

                    /** FutureDue dailyLoad */
                    dailyLoad?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a FutureDue. */
                type $Shape = anki.stats.GraphsResponse.FutureDue.$Properties;
            }

            /**
             * Properties of a Today.
             * @deprecated Use anki.stats.GraphsResponse.Today.$Properties instead.
             */
            interface IToday extends anki.stats.GraphsResponse.Today.$Properties {
            }

            /** Represents a Today. */
            class Today {

                /**
                 * Constructs a new Today.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Today.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Today answerCount. */
                answerCount: number;

                /** Today answerMillis. */
                answerMillis: number;

                /** Today correctCount. */
                correctCount: number;

                /** Today matureCorrect. */
                matureCorrect: number;

                /** Today matureCount. */
                matureCount: number;

                /** Today learnCount. */
                learnCount: number;

                /** Today reviewCount. */
                reviewCount: number;

                /** Today relearnCount. */
                relearnCount: number;

                /** Today earlyReviewCount. */
                earlyReviewCount: number;

                /**
                 * Creates a new Today instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Today instance
                 */
                static create(properties: anki.stats.GraphsResponse.Today.$Shape): anki.stats.GraphsResponse.Today & anki.stats.GraphsResponse.Today.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Today.$Properties): anki.stats.GraphsResponse.Today;

                /**
                 * Encodes the specified Today message. Does not implicitly {@link anki.stats.GraphsResponse.Today.verify|verify} messages.
                 * @param message Today message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Today.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Today message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Today & anki.stats.GraphsResponse.Today.$Shape} Today
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Today & anki.stats.GraphsResponse.Today.$Shape;
            }

            namespace Today {

                /** Properties of a Today. */
                interface $Properties {

                    /** Today answerCount */
                    answerCount?: (number|null);

                    /** Today answerMillis */
                    answerMillis?: (number|null);

                    /** Today correctCount */
                    correctCount?: (number|null);

                    /** Today matureCorrect */
                    matureCorrect?: (number|null);

                    /** Today matureCount */
                    matureCount?: (number|null);

                    /** Today learnCount */
                    learnCount?: (number|null);

                    /** Today reviewCount */
                    reviewCount?: (number|null);

                    /** Today relearnCount */
                    relearnCount?: (number|null);

                    /** Today earlyReviewCount */
                    earlyReviewCount?: (number|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Today. */
                type $Shape = anki.stats.GraphsResponse.Today.$Properties;
            }

            /**
             * Properties of an Hours.
             * @deprecated Use anki.stats.GraphsResponse.Hours.$Properties instead.
             */
            interface IHours extends anki.stats.GraphsResponse.Hours.$Properties {
            }

            /** Represents an Hours. */
            class Hours {

                /**
                 * Constructs a new Hours.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Hours.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Hours oneMonth. */
                oneMonth: anki.stats.GraphsResponse.Hours.Hour.$Properties[];

                /** Hours threeMonths. */
                threeMonths: anki.stats.GraphsResponse.Hours.Hour.$Properties[];

                /** Hours oneYear. */
                oneYear: anki.stats.GraphsResponse.Hours.Hour.$Properties[];

                /** Hours allTime. */
                allTime: anki.stats.GraphsResponse.Hours.Hour.$Properties[];

                /**
                 * Creates a new Hours instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Hours instance
                 */
                static create(properties: anki.stats.GraphsResponse.Hours.$Shape): anki.stats.GraphsResponse.Hours & anki.stats.GraphsResponse.Hours.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Hours.$Properties): anki.stats.GraphsResponse.Hours;

                /**
                 * Encodes the specified Hours message. Does not implicitly {@link anki.stats.GraphsResponse.Hours.verify|verify} messages.
                 * @param message Hours message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Hours.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Hours message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Hours & anki.stats.GraphsResponse.Hours.$Shape} Hours
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Hours & anki.stats.GraphsResponse.Hours.$Shape;
            }

            namespace Hours {

                /** Properties of an Hours. */
                interface $Properties {

                    /** Hours oneMonth */
                    oneMonth?: (anki.stats.GraphsResponse.Hours.Hour.$Properties[]|null);

                    /** Hours threeMonths */
                    threeMonths?: (anki.stats.GraphsResponse.Hours.Hour.$Properties[]|null);

                    /** Hours oneYear */
                    oneYear?: (anki.stats.GraphsResponse.Hours.Hour.$Properties[]|null);

                    /** Hours allTime */
                    allTime?: (anki.stats.GraphsResponse.Hours.Hour.$Properties[]|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of an Hours. */
                type $Shape = anki.stats.GraphsResponse.Hours.$Properties;

                /**
                 * Properties of an Hour.
                 * @deprecated Use anki.stats.GraphsResponse.Hours.Hour.$Properties instead.
                 */
                interface IHour extends anki.stats.GraphsResponse.Hours.Hour.$Properties {
                }

                /** Represents an Hour. */
                class Hour {

                    /**
                     * Constructs a new Hour.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.stats.GraphsResponse.Hours.Hour.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Hour total. */
                    total: number;

                    /** Hour correct. */
                    correct: number;

                    /**
                     * Creates a new Hour instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Hour instance
                     */
                    static create(properties: anki.stats.GraphsResponse.Hours.Hour.$Shape): anki.stats.GraphsResponse.Hours.Hour & anki.stats.GraphsResponse.Hours.Hour.$Shape;
                    static create(properties?: anki.stats.GraphsResponse.Hours.Hour.$Properties): anki.stats.GraphsResponse.Hours.Hour;

                    /**
                     * Encodes the specified Hour message. Does not implicitly {@link anki.stats.GraphsResponse.Hours.Hour.verify|verify} messages.
                     * @param message Hour message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.stats.GraphsResponse.Hours.Hour.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Hour message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.stats.GraphsResponse.Hours.Hour & anki.stats.GraphsResponse.Hours.Hour.$Shape} Hour
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Hours.Hour & anki.stats.GraphsResponse.Hours.Hour.$Shape;
                }

                namespace Hour {

                    /** Properties of an Hour. */
                    interface $Properties {

                        /** Hour total */
                        total?: (number|null);

                        /** Hour correct */
                        correct?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of an Hour. */
                    type $Shape = anki.stats.GraphsResponse.Hours.Hour.$Properties;
                }
            }

            /**
             * Properties of a ReviewCountsAndTimes.
             * @deprecated Use anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties instead.
             */
            interface IReviewCountsAndTimes extends anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties {
            }

            /** Represents a ReviewCountsAndTimes. */
            class ReviewCountsAndTimes {

                /**
                 * Constructs a new ReviewCountsAndTimes.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** ReviewCountsAndTimes count. */
                count: { [k: string]: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties };

                /** ReviewCountsAndTimes time. */
                time: { [k: string]: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties };

                /**
                 * Creates a new ReviewCountsAndTimes instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ReviewCountsAndTimes instance
                 */
                static create(properties: anki.stats.GraphsResponse.ReviewCountsAndTimes.$Shape): anki.stats.GraphsResponse.ReviewCountsAndTimes & anki.stats.GraphsResponse.ReviewCountsAndTimes.$Shape;
                static create(properties?: anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties): anki.stats.GraphsResponse.ReviewCountsAndTimes;

                /**
                 * Encodes the specified ReviewCountsAndTimes message. Does not implicitly {@link anki.stats.GraphsResponse.ReviewCountsAndTimes.verify|verify} messages.
                 * @param message ReviewCountsAndTimes message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a ReviewCountsAndTimes message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.ReviewCountsAndTimes & anki.stats.GraphsResponse.ReviewCountsAndTimes.$Shape} ReviewCountsAndTimes
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.ReviewCountsAndTimes & anki.stats.GraphsResponse.ReviewCountsAndTimes.$Shape;
            }

            namespace ReviewCountsAndTimes {

                /** Properties of a ReviewCountsAndTimes. */
                interface $Properties {

                    /** ReviewCountsAndTimes count */
                    count?: ({ [k: string]: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties }|null);

                    /** ReviewCountsAndTimes time */
                    time?: ({ [k: string]: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties }|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a ReviewCountsAndTimes. */
                type $Shape = anki.stats.GraphsResponse.ReviewCountsAndTimes.$Properties;

                /**
                 * Properties of a Reviews.
                 * @deprecated Use anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties instead.
                 */
                interface IReviews extends anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties {
                }

                /** Represents a Reviews. */
                class Reviews {

                    /**
                     * Constructs a new Reviews.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Reviews learn. */
                    learn: number;

                    /** Reviews relearn. */
                    relearn: number;

                    /** Reviews young. */
                    young: number;

                    /** Reviews mature. */
                    mature: number;

                    /** Reviews filtered. */
                    filtered: number;

                    /**
                     * Creates a new Reviews instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Reviews instance
                     */
                    static create(properties: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Shape): anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews & anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Shape;
                    static create(properties?: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties): anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews;

                    /**
                     * Encodes the specified Reviews message. Does not implicitly {@link anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.verify|verify} messages.
                     * @param message Reviews message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Reviews message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews & anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Shape} Reviews
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews & anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Shape;
                }

                namespace Reviews {

                    /** Properties of a Reviews. */
                    interface $Properties {

                        /** Reviews learn */
                        learn?: (number|null);

                        /** Reviews relearn */
                        relearn?: (number|null);

                        /** Reviews young */
                        young?: (number|null);

                        /** Reviews mature */
                        mature?: (number|null);

                        /** Reviews filtered */
                        filtered?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a Reviews. */
                    type $Shape = anki.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties;
                }
            }

            /**
             * Properties of a Buttons.
             * @deprecated Use anki.stats.GraphsResponse.Buttons.$Properties instead.
             */
            interface IButtons extends anki.stats.GraphsResponse.Buttons.$Properties {
            }

            /** Represents a Buttons. */
            class Buttons {

                /**
                 * Constructs a new Buttons.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.Buttons.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** Buttons oneMonth. */
                oneMonth?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                /** Buttons threeMonths. */
                threeMonths?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                /** Buttons oneYear. */
                oneYear?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                /** Buttons allTime. */
                allTime?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                /**
                 * Creates a new Buttons instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Buttons instance
                 */
                static create(properties: anki.stats.GraphsResponse.Buttons.$Shape): anki.stats.GraphsResponse.Buttons & anki.stats.GraphsResponse.Buttons.$Shape;
                static create(properties?: anki.stats.GraphsResponse.Buttons.$Properties): anki.stats.GraphsResponse.Buttons;

                /**
                 * Encodes the specified Buttons message. Does not implicitly {@link anki.stats.GraphsResponse.Buttons.verify|verify} messages.
                 * @param message Buttons message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.Buttons.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Buttons message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.Buttons & anki.stats.GraphsResponse.Buttons.$Shape} Buttons
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Buttons & anki.stats.GraphsResponse.Buttons.$Shape;
            }

            namespace Buttons {

                /** Properties of a Buttons. */
                interface $Properties {

                    /** Buttons oneMonth */
                    oneMonth?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                    /** Buttons threeMonths */
                    threeMonths?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                    /** Buttons oneYear */
                    oneYear?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                    /** Buttons allTime */
                    allTime?: (anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a Buttons. */
                type $Shape = anki.stats.GraphsResponse.Buttons.$Properties;

                /**
                 * Properties of a ButtonCounts.
                 * @deprecated Use anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties instead.
                 */
                interface IButtonCounts extends anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties {
                }

                /** Represents a ButtonCounts. */
                class ButtonCounts {

                    /**
                     * Constructs a new ButtonCounts.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** ButtonCounts learning. */
                    learning: number[];

                    /** ButtonCounts young. */
                    young: number[];

                    /** ButtonCounts mature. */
                    mature: number[];

                    /**
                     * Creates a new ButtonCounts instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ButtonCounts instance
                     */
                    static create(properties: anki.stats.GraphsResponse.Buttons.ButtonCounts.$Shape): anki.stats.GraphsResponse.Buttons.ButtonCounts & anki.stats.GraphsResponse.Buttons.ButtonCounts.$Shape;
                    static create(properties?: anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties): anki.stats.GraphsResponse.Buttons.ButtonCounts;

                    /**
                     * Encodes the specified ButtonCounts message. Does not implicitly {@link anki.stats.GraphsResponse.Buttons.ButtonCounts.verify|verify} messages.
                     * @param message ButtonCounts message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ButtonCounts message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.stats.GraphsResponse.Buttons.ButtonCounts & anki.stats.GraphsResponse.Buttons.ButtonCounts.$Shape} ButtonCounts
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.Buttons.ButtonCounts & anki.stats.GraphsResponse.Buttons.ButtonCounts.$Shape;
                }

                namespace ButtonCounts {

                    /** Properties of a ButtonCounts. */
                    interface $Properties {

                        /** ButtonCounts learning */
                        learning?: (number[]|null);

                        /** ButtonCounts young */
                        young?: (number[]|null);

                        /** ButtonCounts mature */
                        mature?: (number[]|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a ButtonCounts. */
                    type $Shape = anki.stats.GraphsResponse.Buttons.ButtonCounts.$Properties;
                }
            }

            /**
             * Properties of a CardCounts.
             * @deprecated Use anki.stats.GraphsResponse.CardCounts.$Properties instead.
             */
            interface ICardCounts extends anki.stats.GraphsResponse.CardCounts.$Properties {
            }

            /** Represents a CardCounts. */
            class CardCounts {

                /**
                 * Constructs a new CardCounts.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.CardCounts.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** CardCounts includingInactive. */
                includingInactive?: (anki.stats.GraphsResponse.CardCounts.Counts.$Properties|null);

                /** CardCounts excludingInactive. */
                excludingInactive?: (anki.stats.GraphsResponse.CardCounts.Counts.$Properties|null);

                /**
                 * Creates a new CardCounts instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns CardCounts instance
                 */
                static create(properties: anki.stats.GraphsResponse.CardCounts.$Shape): anki.stats.GraphsResponse.CardCounts & anki.stats.GraphsResponse.CardCounts.$Shape;
                static create(properties?: anki.stats.GraphsResponse.CardCounts.$Properties): anki.stats.GraphsResponse.CardCounts;

                /**
                 * Encodes the specified CardCounts message. Does not implicitly {@link anki.stats.GraphsResponse.CardCounts.verify|verify} messages.
                 * @param message CardCounts message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.CardCounts.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a CardCounts message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.CardCounts & anki.stats.GraphsResponse.CardCounts.$Shape} CardCounts
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.CardCounts & anki.stats.GraphsResponse.CardCounts.$Shape;
            }

            namespace CardCounts {

                /** Properties of a CardCounts. */
                interface $Properties {

                    /** CardCounts includingInactive */
                    includingInactive?: (anki.stats.GraphsResponse.CardCounts.Counts.$Properties|null);

                    /** CardCounts excludingInactive */
                    excludingInactive?: (anki.stats.GraphsResponse.CardCounts.Counts.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a CardCounts. */
                type $Shape = anki.stats.GraphsResponse.CardCounts.$Properties;

                /**
                 * Properties of a Counts.
                 * @deprecated Use anki.stats.GraphsResponse.CardCounts.Counts.$Properties instead.
                 */
                interface ICounts extends anki.stats.GraphsResponse.CardCounts.Counts.$Properties {
                }

                /** Represents a Counts. */
                class Counts {

                    /**
                     * Constructs a new Counts.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.stats.GraphsResponse.CardCounts.Counts.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** Counts newCards. */
                    newCards: number;

                    /** Counts learn. */
                    learn: number;

                    /** Counts relearn. */
                    relearn: number;

                    /** Counts young. */
                    young: number;

                    /** Counts mature. */
                    mature: number;

                    /** Counts suspended. */
                    suspended: number;

                    /** Counts buried. */
                    buried: number;

                    /**
                     * Creates a new Counts instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Counts instance
                     */
                    static create(properties: anki.stats.GraphsResponse.CardCounts.Counts.$Shape): anki.stats.GraphsResponse.CardCounts.Counts & anki.stats.GraphsResponse.CardCounts.Counts.$Shape;
                    static create(properties?: anki.stats.GraphsResponse.CardCounts.Counts.$Properties): anki.stats.GraphsResponse.CardCounts.Counts;

                    /**
                     * Encodes the specified Counts message. Does not implicitly {@link anki.stats.GraphsResponse.CardCounts.Counts.verify|verify} messages.
                     * @param message Counts message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.stats.GraphsResponse.CardCounts.Counts.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Counts message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.stats.GraphsResponse.CardCounts.Counts & anki.stats.GraphsResponse.CardCounts.Counts.$Shape} Counts
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.CardCounts.Counts & anki.stats.GraphsResponse.CardCounts.Counts.$Shape;
                }

                namespace Counts {

                    /** Properties of a Counts. */
                    interface $Properties {

                        /** Counts newCards */
                        newCards?: (number|null);

                        /** Counts learn */
                        learn?: (number|null);

                        /** Counts relearn */
                        relearn?: (number|null);

                        /** Counts young */
                        young?: (number|null);

                        /** Counts mature */
                        mature?: (number|null);

                        /** Counts suspended */
                        suspended?: (number|null);

                        /** Counts buried */
                        buried?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a Counts. */
                    type $Shape = anki.stats.GraphsResponse.CardCounts.Counts.$Properties;
                }
            }

            /**
             * Properties of a TrueRetentionStats.
             * @deprecated Use anki.stats.GraphsResponse.TrueRetentionStats.$Properties instead.
             */
            interface ITrueRetentionStats extends anki.stats.GraphsResponse.TrueRetentionStats.$Properties {
            }

            /** Represents a TrueRetentionStats. */
            class TrueRetentionStats {

                /**
                 * Constructs a new TrueRetentionStats.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: anki.stats.GraphsResponse.TrueRetentionStats.$Properties);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];

                /** TrueRetentionStats today. */
                today?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /** TrueRetentionStats yesterday. */
                yesterday?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /** TrueRetentionStats week. */
                week?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /** TrueRetentionStats month. */
                month?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /** TrueRetentionStats year. */
                year?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /** TrueRetentionStats allTime. */
                allTime?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                /**
                 * Creates a new TrueRetentionStats instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns TrueRetentionStats instance
                 */
                static create(properties: anki.stats.GraphsResponse.TrueRetentionStats.$Shape): anki.stats.GraphsResponse.TrueRetentionStats & anki.stats.GraphsResponse.TrueRetentionStats.$Shape;
                static create(properties?: anki.stats.GraphsResponse.TrueRetentionStats.$Properties): anki.stats.GraphsResponse.TrueRetentionStats;

                /**
                 * Encodes the specified TrueRetentionStats message. Does not implicitly {@link anki.stats.GraphsResponse.TrueRetentionStats.verify|verify} messages.
                 * @param message TrueRetentionStats message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                static encode(message: anki.stats.GraphsResponse.TrueRetentionStats.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a TrueRetentionStats message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns {anki.stats.GraphsResponse.TrueRetentionStats & anki.stats.GraphsResponse.TrueRetentionStats.$Shape} TrueRetentionStats
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.TrueRetentionStats & anki.stats.GraphsResponse.TrueRetentionStats.$Shape;
            }

            namespace TrueRetentionStats {

                /** Properties of a TrueRetentionStats. */
                interface $Properties {

                    /** TrueRetentionStats today */
                    today?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** TrueRetentionStats yesterday */
                    yesterday?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** TrueRetentionStats week */
                    week?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** TrueRetentionStats month */
                    month?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** TrueRetentionStats year */
                    year?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** TrueRetentionStats allTime */
                    allTime?: (anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties|null);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];
                }

                /** Shape of a TrueRetentionStats. */
                type $Shape = anki.stats.GraphsResponse.TrueRetentionStats.$Properties;

                /**
                 * Properties of a TrueRetention.
                 * @deprecated Use anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties instead.
                 */
                interface ITrueRetention extends anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties {
                }

                /** Represents a TrueRetention. */
                class TrueRetention {

                    /**
                     * Constructs a new TrueRetention.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties);

                    /** Unknown fields preserved while decoding when enabled */
                    $unknowns?: Uint8Array[];

                    /** TrueRetention youngPassed. */
                    youngPassed: number;

                    /** TrueRetention youngFailed. */
                    youngFailed: number;

                    /** TrueRetention maturePassed. */
                    maturePassed: number;

                    /** TrueRetention matureFailed. */
                    matureFailed: number;

                    /**
                     * Creates a new TrueRetention instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TrueRetention instance
                     */
                    static create(properties: anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Shape): anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention & anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Shape;
                    static create(properties?: anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties): anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention;

                    /**
                     * Encodes the specified TrueRetention message. Does not implicitly {@link anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.verify|verify} messages.
                     * @param message TrueRetention message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    static encode(message: anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TrueRetention message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns {anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention & anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Shape} TrueRetention
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention & anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Shape;
                }

                namespace TrueRetention {

                    /** Properties of a TrueRetention. */
                    interface $Properties {

                        /** TrueRetention youngPassed */
                        youngPassed?: (number|null);

                        /** TrueRetention youngFailed */
                        youngFailed?: (number|null);

                        /** TrueRetention maturePassed */
                        maturePassed?: (number|null);

                        /** TrueRetention matureFailed */
                        matureFailed?: (number|null);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];
                    }

                    /** Shape of a TrueRetention. */
                    type $Shape = anki.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties;
                }
            }
        }

        /**
         * Properties of a GraphPreferences.
         * @deprecated Use anki.stats.GraphPreferences.$Properties instead.
         */
        interface IGraphPreferences extends anki.stats.GraphPreferences.$Properties {
        }

        /** Represents a GraphPreferences. */
        class GraphPreferences {

            /**
             * Constructs a new GraphPreferences.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.GraphPreferences.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** GraphPreferences calendarFirstDayOfWeek. */
            calendarFirstDayOfWeek: anki.stats.GraphPreferences.Weekday;

            /** GraphPreferences cardCountsSeparateInactive. */
            cardCountsSeparateInactive: boolean;

            /** GraphPreferences browserLinksSupported. */
            browserLinksSupported: boolean;

            /** GraphPreferences futureDueShowBacklog. */
            futureDueShowBacklog: boolean;

            /**
             * Creates a new GraphPreferences instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GraphPreferences instance
             */
            static create(properties: anki.stats.GraphPreferences.$Shape): anki.stats.GraphPreferences & anki.stats.GraphPreferences.$Shape;
            static create(properties?: anki.stats.GraphPreferences.$Properties): anki.stats.GraphPreferences;

            /**
             * Encodes the specified GraphPreferences message. Does not implicitly {@link anki.stats.GraphPreferences.verify|verify} messages.
             * @param message GraphPreferences message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.GraphPreferences.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GraphPreferences message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.GraphPreferences & anki.stats.GraphPreferences.$Shape} GraphPreferences
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.GraphPreferences & anki.stats.GraphPreferences.$Shape;
        }

        namespace GraphPreferences {

            /** Properties of a GraphPreferences. */
            interface $Properties {

                /** GraphPreferences calendarFirstDayOfWeek */
                calendarFirstDayOfWeek?: (anki.stats.GraphPreferences.Weekday|null);

                /** GraphPreferences cardCountsSeparateInactive */
                cardCountsSeparateInactive?: (boolean|null);

                /** GraphPreferences browserLinksSupported */
                browserLinksSupported?: (boolean|null);

                /** GraphPreferences futureDueShowBacklog */
                futureDueShowBacklog?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a GraphPreferences. */
            type $Shape = anki.stats.GraphPreferences.$Properties;

            /** Weekday enum. */
            enum Weekday {

                /** SUNDAY value */
                SUNDAY = 0,

                /** MONDAY value */
                MONDAY = 1,

                /** FRIDAY value */
                FRIDAY = 5,

                /** SATURDAY value */
                SATURDAY = 6
            }
        }

        /**
         * Properties of a RevlogEntry.
         * @deprecated Use anki.stats.RevlogEntry.$Properties instead.
         */
        interface IRevlogEntry extends anki.stats.RevlogEntry.$Properties {
        }

        /** Represents a RevlogEntry. */
        class RevlogEntry {

            /**
             * Constructs a new RevlogEntry.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.stats.RevlogEntry.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /**
             * Creates a new RevlogEntry instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RevlogEntry instance
             */
            static create(properties: anki.stats.RevlogEntry.$Shape): anki.stats.RevlogEntry & anki.stats.RevlogEntry.$Shape;
            static create(properties?: anki.stats.RevlogEntry.$Properties): anki.stats.RevlogEntry;

            /**
             * Encodes the specified RevlogEntry message. Does not implicitly {@link anki.stats.RevlogEntry.verify|verify} messages.
             * @param message RevlogEntry message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.stats.RevlogEntry.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RevlogEntry message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.stats.RevlogEntry & anki.stats.RevlogEntry.$Shape} RevlogEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.stats.RevlogEntry & anki.stats.RevlogEntry.$Shape;
        }

        namespace RevlogEntry {

            /** Properties of a RevlogEntry. */
            interface $Properties {

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RevlogEntry. */
            type $Shape = anki.stats.RevlogEntry.$Properties;

            /** ReviewKind enum. */
            enum ReviewKind {

                /** LEARNING value */
                LEARNING = 0,

                /** REVIEW value */
                REVIEW = 1,

                /** RELEARNING value */
                RELEARNING = 2,

                /** FILTERED value */
                FILTERED = 3,

                /** MANUAL value */
                MANUAL = 4,

                /** RESCHEDULED value */
                RESCHEDULED = 5
            }
        }
    }

    /** Namespace tags. */
    namespace tags {

        /**
         * Properties of a TagTreeNode.
         * @deprecated Use anki.tags.TagTreeNode.$Properties instead.
         */
        interface ITagTreeNode extends anki.tags.TagTreeNode.$Properties {
        }

        /** Represents a TagTreeNode. */
        class TagTreeNode {

            /**
             * Constructs a new TagTreeNode.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.TagTreeNode.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** TagTreeNode name. */
            name: string;

            /** TagTreeNode children. */
            children: anki.tags.TagTreeNode.$Properties[];

            /** TagTreeNode level. */
            level: number;

            /** TagTreeNode collapsed. */
            collapsed: boolean;

            /**
             * Creates a new TagTreeNode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TagTreeNode instance
             */
            static create(properties: anki.tags.TagTreeNode.$Shape): anki.tags.TagTreeNode & anki.tags.TagTreeNode.$Shape;
            static create(properties?: anki.tags.TagTreeNode.$Properties): anki.tags.TagTreeNode;

            /**
             * Encodes the specified TagTreeNode message. Does not implicitly {@link anki.tags.TagTreeNode.verify|verify} messages.
             * @param message TagTreeNode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.TagTreeNode.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TagTreeNode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.TagTreeNode & anki.tags.TagTreeNode.$Shape} TagTreeNode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.TagTreeNode & anki.tags.TagTreeNode.$Shape;
        }

        namespace TagTreeNode {

            /** Properties of a TagTreeNode. */
            interface $Properties {

                /** TagTreeNode name */
                name?: (string|null);

                /** TagTreeNode children */
                children?: (anki.tags.TagTreeNode.$Properties[]|null);

                /** TagTreeNode level */
                level?: (number|null);

                /** TagTreeNode collapsed */
                collapsed?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a TagTreeNode. */
            type $Shape = anki.tags.TagTreeNode.$Properties;
        }

        /**
         * Properties of a ReparentTagsRequest.
         * @deprecated Use anki.tags.ReparentTagsRequest.$Properties instead.
         */
        interface IReparentTagsRequest extends anki.tags.ReparentTagsRequest.$Properties {
        }

        /** Represents a ReparentTagsRequest. */
        class ReparentTagsRequest {

            /**
             * Constructs a new ReparentTagsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.ReparentTagsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** ReparentTagsRequest tags. */
            tags: string[];

            /** ReparentTagsRequest newParent. */
            newParent: string;

            /**
             * Creates a new ReparentTagsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ReparentTagsRequest instance
             */
            static create(properties: anki.tags.ReparentTagsRequest.$Shape): anki.tags.ReparentTagsRequest & anki.tags.ReparentTagsRequest.$Shape;
            static create(properties?: anki.tags.ReparentTagsRequest.$Properties): anki.tags.ReparentTagsRequest;

            /**
             * Encodes the specified ReparentTagsRequest message. Does not implicitly {@link anki.tags.ReparentTagsRequest.verify|verify} messages.
             * @param message ReparentTagsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.ReparentTagsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ReparentTagsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.ReparentTagsRequest & anki.tags.ReparentTagsRequest.$Shape} ReparentTagsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.ReparentTagsRequest & anki.tags.ReparentTagsRequest.$Shape;
        }

        namespace ReparentTagsRequest {

            /** Properties of a ReparentTagsRequest. */
            interface $Properties {

                /** ReparentTagsRequest tags */
                tags?: (string[]|null);

                /** ReparentTagsRequest newParent */
                newParent?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a ReparentTagsRequest. */
            type $Shape = anki.tags.ReparentTagsRequest.$Properties;
        }

        /**
         * Properties of a RenameTagsRequest.
         * @deprecated Use anki.tags.RenameTagsRequest.$Properties instead.
         */
        interface IRenameTagsRequest extends anki.tags.RenameTagsRequest.$Properties {
        }

        /** Represents a RenameTagsRequest. */
        class RenameTagsRequest {

            /**
             * Constructs a new RenameTagsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.RenameTagsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** RenameTagsRequest currentPrefix. */
            currentPrefix: string;

            /** RenameTagsRequest newPrefix. */
            newPrefix: string;

            /**
             * Creates a new RenameTagsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RenameTagsRequest instance
             */
            static create(properties: anki.tags.RenameTagsRequest.$Shape): anki.tags.RenameTagsRequest & anki.tags.RenameTagsRequest.$Shape;
            static create(properties?: anki.tags.RenameTagsRequest.$Properties): anki.tags.RenameTagsRequest;

            /**
             * Encodes the specified RenameTagsRequest message. Does not implicitly {@link anki.tags.RenameTagsRequest.verify|verify} messages.
             * @param message RenameTagsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.RenameTagsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RenameTagsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.RenameTagsRequest & anki.tags.RenameTagsRequest.$Shape} RenameTagsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.RenameTagsRequest & anki.tags.RenameTagsRequest.$Shape;
        }

        namespace RenameTagsRequest {

            /** Properties of a RenameTagsRequest. */
            interface $Properties {

                /** RenameTagsRequest currentPrefix */
                currentPrefix?: (string|null);

                /** RenameTagsRequest newPrefix */
                newPrefix?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a RenameTagsRequest. */
            type $Shape = anki.tags.RenameTagsRequest.$Properties;
        }

        /**
         * Properties of a NoteIdsAndTagsRequest.
         * @deprecated Use anki.tags.NoteIdsAndTagsRequest.$Properties instead.
         */
        interface INoteIdsAndTagsRequest extends anki.tags.NoteIdsAndTagsRequest.$Properties {
        }

        /** Represents a NoteIdsAndTagsRequest. */
        class NoteIdsAndTagsRequest {

            /**
             * Constructs a new NoteIdsAndTagsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.NoteIdsAndTagsRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** NoteIdsAndTagsRequest noteIds. */
            noteIds: (number|Long)[];

            /** NoteIdsAndTagsRequest tags. */
            tags: string;

            /**
             * Creates a new NoteIdsAndTagsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NoteIdsAndTagsRequest instance
             */
            static create(properties: anki.tags.NoteIdsAndTagsRequest.$Shape): anki.tags.NoteIdsAndTagsRequest & anki.tags.NoteIdsAndTagsRequest.$Shape;
            static create(properties?: anki.tags.NoteIdsAndTagsRequest.$Properties): anki.tags.NoteIdsAndTagsRequest;

            /**
             * Encodes the specified NoteIdsAndTagsRequest message. Does not implicitly {@link anki.tags.NoteIdsAndTagsRequest.verify|verify} messages.
             * @param message NoteIdsAndTagsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.NoteIdsAndTagsRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NoteIdsAndTagsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.NoteIdsAndTagsRequest & anki.tags.NoteIdsAndTagsRequest.$Shape} NoteIdsAndTagsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.NoteIdsAndTagsRequest & anki.tags.NoteIdsAndTagsRequest.$Shape;
        }

        namespace NoteIdsAndTagsRequest {

            /** Properties of a NoteIdsAndTagsRequest. */
            interface $Properties {

                /** NoteIdsAndTagsRequest noteIds */
                noteIds?: ((number|Long)[]|null);

                /** NoteIdsAndTagsRequest tags */
                tags?: (string|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a NoteIdsAndTagsRequest. */
            type $Shape = anki.tags.NoteIdsAndTagsRequest.$Properties;
        }

        /**
         * Properties of a FindAndReplaceTagRequest.
         * @deprecated Use anki.tags.FindAndReplaceTagRequest.$Properties instead.
         */
        interface IFindAndReplaceTagRequest extends anki.tags.FindAndReplaceTagRequest.$Properties {
        }

        /** Represents a FindAndReplaceTagRequest. */
        class FindAndReplaceTagRequest {

            /**
             * Constructs a new FindAndReplaceTagRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.FindAndReplaceTagRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** FindAndReplaceTagRequest noteIds. */
            noteIds: (number|Long)[];

            /** FindAndReplaceTagRequest search. */
            search: string;

            /** FindAndReplaceTagRequest replacement. */
            replacement: string;

            /** FindAndReplaceTagRequest regex. */
            regex: boolean;

            /** FindAndReplaceTagRequest matchCase. */
            matchCase: boolean;

            /**
             * Creates a new FindAndReplaceTagRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FindAndReplaceTagRequest instance
             */
            static create(properties: anki.tags.FindAndReplaceTagRequest.$Shape): anki.tags.FindAndReplaceTagRequest & anki.tags.FindAndReplaceTagRequest.$Shape;
            static create(properties?: anki.tags.FindAndReplaceTagRequest.$Properties): anki.tags.FindAndReplaceTagRequest;

            /**
             * Encodes the specified FindAndReplaceTagRequest message. Does not implicitly {@link anki.tags.FindAndReplaceTagRequest.verify|verify} messages.
             * @param message FindAndReplaceTagRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.FindAndReplaceTagRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FindAndReplaceTagRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.FindAndReplaceTagRequest & anki.tags.FindAndReplaceTagRequest.$Shape} FindAndReplaceTagRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.FindAndReplaceTagRequest & anki.tags.FindAndReplaceTagRequest.$Shape;
        }

        namespace FindAndReplaceTagRequest {

            /** Properties of a FindAndReplaceTagRequest. */
            interface $Properties {

                /** FindAndReplaceTagRequest noteIds */
                noteIds?: ((number|Long)[]|null);

                /** FindAndReplaceTagRequest search */
                search?: (string|null);

                /** FindAndReplaceTagRequest replacement */
                replacement?: (string|null);

                /** FindAndReplaceTagRequest regex */
                regex?: (boolean|null);

                /** FindAndReplaceTagRequest matchCase */
                matchCase?: (boolean|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a FindAndReplaceTagRequest. */
            type $Shape = anki.tags.FindAndReplaceTagRequest.$Properties;
        }

        /**
         * Properties of a CompleteTagRequest.
         * @deprecated Use anki.tags.CompleteTagRequest.$Properties instead.
         */
        interface ICompleteTagRequest extends anki.tags.CompleteTagRequest.$Properties {
        }

        /** Represents a CompleteTagRequest. */
        class CompleteTagRequest {

            /**
             * Constructs a new CompleteTagRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.CompleteTagRequest.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CompleteTagRequest input. */
            input: string;

            /** CompleteTagRequest matchLimit. */
            matchLimit: number;

            /**
             * Creates a new CompleteTagRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CompleteTagRequest instance
             */
            static create(properties: anki.tags.CompleteTagRequest.$Shape): anki.tags.CompleteTagRequest & anki.tags.CompleteTagRequest.$Shape;
            static create(properties?: anki.tags.CompleteTagRequest.$Properties): anki.tags.CompleteTagRequest;

            /**
             * Encodes the specified CompleteTagRequest message. Does not implicitly {@link anki.tags.CompleteTagRequest.verify|verify} messages.
             * @param message CompleteTagRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.CompleteTagRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CompleteTagRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.CompleteTagRequest & anki.tags.CompleteTagRequest.$Shape} CompleteTagRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.CompleteTagRequest & anki.tags.CompleteTagRequest.$Shape;
        }

        namespace CompleteTagRequest {

            /** Properties of a CompleteTagRequest. */
            interface $Properties {

                /** CompleteTagRequest input */
                input?: (string|null);

                /** CompleteTagRequest matchLimit */
                matchLimit?: (number|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CompleteTagRequest. */
            type $Shape = anki.tags.CompleteTagRequest.$Properties;
        }

        /**
         * Properties of a CompleteTagResponse.
         * @deprecated Use anki.tags.CompleteTagResponse.$Properties instead.
         */
        interface ICompleteTagResponse extends anki.tags.CompleteTagResponse.$Properties {
        }

        /** Represents a CompleteTagResponse. */
        class CompleteTagResponse {

            /**
             * Constructs a new CompleteTagResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: anki.tags.CompleteTagResponse.$Properties);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];

            /** CompleteTagResponse tags. */
            tags: string[];

            /**
             * Creates a new CompleteTagResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CompleteTagResponse instance
             */
            static create(properties: anki.tags.CompleteTagResponse.$Shape): anki.tags.CompleteTagResponse & anki.tags.CompleteTagResponse.$Shape;
            static create(properties?: anki.tags.CompleteTagResponse.$Properties): anki.tags.CompleteTagResponse;

            /**
             * Encodes the specified CompleteTagResponse message. Does not implicitly {@link anki.tags.CompleteTagResponse.verify|verify} messages.
             * @param message CompleteTagResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            static encode(message: anki.tags.CompleteTagResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CompleteTagResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns {anki.tags.CompleteTagResponse & anki.tags.CompleteTagResponse.$Shape} CompleteTagResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): anki.tags.CompleteTagResponse & anki.tags.CompleteTagResponse.$Shape;
        }

        namespace CompleteTagResponse {

            /** Properties of a CompleteTagResponse. */
            interface $Properties {

                /** CompleteTagResponse tags */
                tags?: (string[]|null);

                /** Unknown fields preserved while decoding when enabled */
                $unknowns?: Uint8Array[];
            }

            /** Shape of a CompleteTagResponse. */
            type $Shape = anki.tags.CompleteTagResponse.$Properties;
        }
    }
}
