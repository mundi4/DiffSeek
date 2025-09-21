import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useAtom } from "jotai";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import * as cstyles from "./DiffOptionsDrawer.controls.css";
import { vars } from "@/styles/vars.css";
import { useState } from "react";

export function OptionsControls() {
    const [options, setOptions] = useAtom(diffOptionsAtom);

    // tolerance (오차 기반)
    const [toleranceValue, setToleranceValue] = useState(
        100 - options.compareImageTolerance
    );

    const enableImageComparisonOptions = window.extensionEnabled;

    return (
        <section>
            <div className={cstyles.optionGrid}>
                {/* 공백 처리 */}
                <div className={cstyles.optionCard}>
                    <label className={cstyles.optionLabel}>공백 처리</label>
                    <RadioGroup.Root
                        className={cstyles.radioRoot}
                        value={options.ignoreWhitespace}
                        onValueChange={(v) =>
                            setOptions({ ...options, ignoreWhitespace: v as any })
                        }
                    >
                        <label>
                            <RadioGroup.Item
                                value="ignore"
                                className={cstyles.radioItem}
                            >
                                <RadioGroup.Indicator
                                    className={cstyles.radioIndicator}
                                />
                            </RadioGroup.Item>{" "}
                            무시 <span className={cstyles.descriptionText}>한국어만큼 띄어쓰기가 헷갈리는 언어는 없으니까</span>
                        </label>
                        <label>
                            <RadioGroup.Item
                                value="normalize"
                                className={cstyles.radioItem}
                            >
                                <RadioGroup.Indicator
                                    className={cstyles.radioIndicator}
                                />
                            </RadioGroup.Item>{" "}
                            정규화 <span className={cstyles.descriptionText}>하나 이상의 공백을 하나로 취급</span>
                        </label>
                        <label>
                            <RadioGroup.Item
                                value="onlyAtEdge"
                                className={cstyles.radioItem}
                            >
                                <RadioGroup.Indicator
                                    className={cstyles.radioIndicator}
                                />
                            </RadioGroup.Item>{" "}
                            줄바꿈 경계 <span className={cstyles.descriptionText}>줄의 시작과 끝에서 공백 무시</span>
                        </label>
                    </RadioGroup.Root>
                </div>

                {/* sup/sub */}
                <div className={cstyles.optionCard}>
                    <label className={cstyles.optionLabel}>윗첨자/아랫첨자 비교</label>
                    <span className={cstyles.descriptionText}>의뢰부서에서 자꾸 전화하는 그 부분..</span>
                    <Switch.Root
                        className={cstyles.switchRoot}
                        checked={options.compareSupSub}
                        onCheckedChange={(v) =>
                            setOptions({ ...options, compareSupSub: v })
                        }
                    >
                        <Switch.Thumb className={cstyles.switchThumb} />
                    </Switch.Root>
                </div>

                {/* 이미지 비교 */}
                {enableImageComparisonOptions &&
                    <div className={cstyles.optionCard}>
                        <label className={cstyles.optionLabel}>상세 이미지 비교</label>
                        <span className={cstyles.descriptionText}><em>가능한 경우</em> 픽셀 단위로 한땀한땀 비교...</span>
                        <Switch.Root
                            className={cstyles.switchRoot}
                            checked={options.compareImage}
                            onCheckedChange={(v) =>
                                setOptions({ ...options, compareImage: v })
                            }
                        >
                            <Switch.Thumb className={cstyles.switchThumb} />
                        </Switch.Root>

                        <span style={{ fontSize: vars.typography.size.xs }}>
                            허용 오차: {toleranceValue.toFixed(1)}%
                        </span>
                        <Slider.Root
                            className={cstyles.sliderRoot}
                            value={[toleranceValue]}
                            onValueChange={([v]) => setToleranceValue(v)}
                            onValueCommit={([v]) =>
                                setOptions({ ...options, compareImageTolerance: 100 - v })
                            }
                            min={0}
                            max={10}
                            step={0.1}
                            disabled={!options.compareImage}
                        >
                            <Slider.Track className={cstyles.sliderTrack}>
                                <Slider.Range className={cstyles.sliderRange} />
                            </Slider.Track>
                            <Slider.Thumb className={cstyles.sliderThumb} />
                        </Slider.Root>
                    </div>
                }
            </div>


        </section>
    );
}

// {/* ================= 실험적 옵션 ================= */}
//             <h3 style={{ marginBottom: vars.spacing.md }}>⚠ 실험적 옵션</h3>
//             <div className={cstyles.experimentalGroup}>
//                 {/* ===== 길이 관련 ===== */}
//                 <fieldset className={cstyles.optionGroup}>
//                     <legend>길이 관련</legend>
//                     <div className={cstyles.optionRow}>
//                         <label>길이 보정</label>
//                         <Switch.Root
//                             className={cstyles.switchRoot}
//                             checked={!!options.useLengthBias}
//                             onCheckedChange={(v) =>
//                                 setOptions({ ...options, useLengthBias: v })
//                             }
//                         >
//                             <Switch.Thumb className={cstyles.switchThumb} />
//                         </Switch.Root>
//                     </div>

//                     <div className={cstyles.optionRow}>
//                         <label>보정 계수</label>
//                         <Slider.Root
//                             className={cstyles.sliderRoot}
//                             value={[options.lengthBiasFactor]}
//                             onValueChange={([v]) =>
//                                 setOptions({ ...options, lengthBiasFactor: v })
//                             }
//                             min={0.1}
//                             max={2}
//                             step={0.1}
//                         >
//                             <Slider.Track className={cstyles.sliderTrack}>
//                                 <Slider.Range className={cstyles.sliderRange} />
//                             </Slider.Track>
//                             <Slider.Thumb className={cstyles.sliderThumb} />
//                         </Slider.Root>
//                         <span>{options.lengthBiasFactor.toFixed(2)}</span>
//                     </div>

//                     <div className={cstyles.optionRow}>
//                         <label>Max Gram</label>
//                         <input
//                             type="number"
//                             min={1}
//                             max={10}
//                             value={options.maxGram}
//                             onChange={(e) =>
//                                 setOptions({ ...options, maxGram: Number(e.target.value) })
//                             }
//                         />
//                     </div>
//                 </fieldset>

//                 {/* ===== 앵커 보정 ===== */}
//                 <fieldset className={cstyles.optionGroup}>
//                     <legend>앵커 보정</legend>
//                     {([
//                         ["섹션 제목", "sectionHeadingMultiplier"],
//                         ["컨테이너 시작", "containerStartMultiplier"],
//                         ["컨테이너 끝", "containerEndMultiplier"],
//                         ["라인 시작", "lineStartMultiplier"],
//                         ["라인 끝", "lineEndMultiplier"],
//                         ["고유 토큰", "uniqueMultiplier"],
//                     ] as const).map(([label, key]) => (
//                         <div key={key} className={cstyles.optionRow}>
//                             <label>{label}</label>
//                             <Slider.Root
//                                 className={cstyles.sliderRoot}
//                                 value={[options[key]]}
//                                 onValueChange={([v]) => setOptions({ ...options, [key]: v })}
//                                 min={0.5}
//                                 max={2}
//                                 step={0.01}
//                             >
//                                 <Slider.Track className={cstyles.sliderTrack}>
//                                     <Slider.Range className={cstyles.sliderRange} />
//                                 </Slider.Track>
//                                 <Slider.Thumb className={cstyles.sliderThumb} />
//                             </Slider.Root>
//                             <span style={{fontSize:vars.typography.size.xs}}>{options[key].toFixed(2)}</span>
//                         </div>
//                     ))}
//                 </fieldset>
//             </div>