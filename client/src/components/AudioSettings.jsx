import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mic, Volume2, ChevronDown, Activity } from 'lucide-react';

/**
 * Modal de configurações de áudio.
 * Permite selecionar dispositivos de entrada (microfone) e saída (alto-falante).
 * Inclui teste de microfone com visualização de volume em tempo real.
 */
export default function AudioSettings({
    isOpen,
    onClose,
    audioInputDeviceId,
    audioOutputDeviceId,
    onChangeInput,
    onChangeOutput,
}) {
    const [inputDevices, setInputDevices] = useState([]);
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedInput, setSelectedInput] = useState(audioInputDeviceId || '');
    const [selectedOutput, setSelectedOutput] = useState(audioOutputDeviceId || '');
    const [isTesting, setIsTesting] = useState(false);
    const [micLevel, setMicLevel] = useState(0);

    const testStream = useRef(null);
    const testContext = useRef(null);
    const testAnalyser = useRef(null);
    const testInterval = useRef(null);

    // Carrega a lista de dispositivos
    const loadDevices = useCallback(async () => {
        try {
            if (!navigator.mediaDevices) {
                console.warn('API de áudio não suportada. É necessário HTTPS ou localhost.');
                return;
            }

            // Pede permissão primeiro (necessário para ver os labels)
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => stream.getTracks().forEach((t) => t.stop()));

            const devices = await navigator.mediaDevices.enumerateDevices();

            const inputs = devices.filter((d) => d.kind === 'audioinput');
            const outputs = devices.filter((d) => d.kind === 'audiooutput');

            setInputDevices(inputs);
            setOutputDevices(outputs);

            // Se não tem seleção, usa o default
            if (!selectedInput && inputs.length > 0) {
                setSelectedInput(inputs[0].deviceId);
            }
            if (!selectedOutput && outputs.length > 0) {
                setSelectedOutput(outputs[0].deviceId);
            }
        } catch (err) {
            console.error('Erro ao carregar dispositivos:', err);
        }
    }, [selectedInput, selectedOutput]);

    useEffect(() => {
        if (isOpen) {
            loadDevices();
        }

        return () => {
            stopMicTest();
        };
    }, [isOpen, loadDevices]);

    // Sync com props externas
    useEffect(() => {
        if (audioInputDeviceId) setSelectedInput(audioInputDeviceId);
    }, [audioInputDeviceId]);

    useEffect(() => {
        if (audioOutputDeviceId) setSelectedOutput(audioOutputDeviceId);
    }, [audioOutputDeviceId]);

    // Escuta mudanças de dispositivos (plugar/desplugar headset etc)
    useEffect(() => {
        if (!navigator.mediaDevices) return;

        const handleDeviceChange = () => loadDevices();
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }, [loadDevices]);

    const handleInputChange = (e) => {
        const deviceId = e.target.value;
        setSelectedInput(deviceId);
        onChangeInput(deviceId);
        localStorage.setItem('audioInputDeviceId', deviceId);

        // Se está testando, reinicia com o novo device
        if (isTesting) {
            stopMicTest();
            setTimeout(() => startMicTest(deviceId), 100);
        }
    };

    const handleOutputChange = (e) => {
        const deviceId = e.target.value;
        setSelectedOutput(deviceId);
        onChangeOutput(deviceId);
        localStorage.setItem('audioOutputDeviceId', deviceId);
    };

    const startMicTest = async (deviceId) => {
        const targetDevice = deviceId || selectedInput;
        try {
            const constraints = {
                audio: targetDevice
                    ? { deviceId: { exact: targetDevice } }
                    : true,
            };

            testStream.current = await navigator.mediaDevices.getUserMedia(constraints);
            testContext.current = new AudioContext();
            const source = testContext.current.createMediaStreamSource(testStream.current);
            testAnalyser.current = testContext.current.createAnalyser();
            testAnalyser.current.fftSize = 256;
            testAnalyser.current.smoothingTimeConstant = 0.5;
            source.connect(testAnalyser.current);

            const dataArray = new Uint8Array(testAnalyser.current.frequencyBinCount);

            testInterval.current = setInterval(() => {
                if (!testAnalyser.current) return;
                testAnalyser.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setMicLevel(Math.min(100, (avg / 128) * 100));
            }, 50);

            setIsTesting(true);
        } catch (err) {
            console.error('Erro no teste de microfone:', err);
        }
    };

    const stopMicTest = () => {
        if (testInterval.current) {
            clearInterval(testInterval.current);
            testInterval.current = null;
        }
        if (testStream.current) {
            testStream.current.getTracks().forEach((t) => t.stop());
            testStream.current = null;
        }
        if (testContext.current) {
            testContext.current.close().catch(() => {});
            testContext.current = null;
            testAnalyser.current = null;
        }
        setIsTesting(false);
        setMicLevel(0);
    };

    const handleClose = () => {
        stopMicTest();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="audio-settings-overlay" onClick={handleClose}>
            <div
                className="audio-settings-modal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="audio-settings-header">
                    <div className="audio-settings-title">
                        <Activity size={20} />
                        <span>Configurações de Áudio</span>
                    </div>
                    <button
                        className="audio-settings-close"
                        onClick={handleClose}
                        id="audio-settings-close-btn"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="audio-settings-content">
                    {/* Input Device */}
                    <div className="audio-settings-section">
                        <label className="audio-settings-label">
                            <Mic size={14} />
                            Dispositivo de Entrada
                        </label>
                        <div className="audio-select-wrapper">
                            <select
                                className="audio-select"
                                value={selectedInput}
                                onChange={handleInputChange}
                                id="audio-input-select"
                            >
                                {inputDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="audio-select-arrow" />
                        </div>

                        {/* Mic Test */}
                        <div className="mic-test-section">
                            <button
                                className={`mic-test-btn ${isTesting ? 'testing' : ''}`}
                                onClick={() => isTesting ? stopMicTest() : startMicTest()}
                                id="mic-test-btn"
                            >
                                <Mic size={14} />
                                {isTesting ? 'Parar Teste' : 'Testar Microfone'}
                            </button>

                            {isTesting && (
                                <div className="mic-level-container">
                                    <div className="mic-level-bar">
                                        <div
                                            className="mic-level-fill"
                                            style={{ width: `${micLevel}%` }}
                                        />
                                    </div>
                                    <span className="mic-level-text">
                                        {Math.round(micLevel)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Output Device */}
                    <div className="audio-settings-section">
                        <label className="audio-settings-label">
                            <Volume2 size={14} />
                            Dispositivo de Saída
                        </label>
                        <div className="audio-select-wrapper">
                            <select
                                className="audio-select"
                                value={selectedOutput}
                                onChange={handleOutputChange}
                                id="audio-output-select"
                            >
                                {outputDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Alto-falante ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="audio-select-arrow" />
                        </div>

                        {outputDevices.length === 0 && (
                            <p className="audio-settings-hint">
                                A seleção de saída pode não estar disponível neste navegador.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
