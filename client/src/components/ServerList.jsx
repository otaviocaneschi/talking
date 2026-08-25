import { Plus, Compass } from 'lucide-react';

export default function ServerList({ servers, activeServerId, onSelectServer, onOpenModal }) {
    return (
        <div className="server-list">
            <div className="server-item-wrapper">
                <div 
                    className={`server-item ${!activeServerId ? 'active default' : 'default'}`}
                    onClick={() => onSelectServer(null)}
                >
                    <Compass size={24} />
                </div>
                {!activeServerId && <div className="server-active-pill" />}
            </div>

            <div className="server-separator" />

            {servers.map((server) => (
                <div key={server.id} className="server-item-wrapper">
                    <div 
                        className={`server-item ${activeServerId === server.id ? 'active' : ''}`}
                        onClick={() => onSelectServer(server.id)}
                        title={server.name}
                    >
                        {server.name.substring(0, 2).toUpperCase()}
                    </div>
                    {activeServerId === server.id && <div className="server-active-pill" />}
                </div>
            ))}

            <div className="server-item-wrapper">
                <div 
                    className="server-item action"
                    onClick={onOpenModal}
                    title="Adicionar Servidor"
                >
                    <Plus size={24} />
                </div>
            </div>
        </div>
    );
}
