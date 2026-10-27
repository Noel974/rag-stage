export interface CardProps {
  title: string;
  description: string;
  image?: string;
  onButtonClick?: () => void;
  children?: React.ReactNode;   
}

export default function Card({ title, description, image, onButtonClick, children }: CardProps) {
  return (
    <article className="card">
        {image && <img src={image} alt={title} className="card-image" />}
        <div className="card-content">
            <h3 className="card-title">{title}</h3>
            <p className="card-description">{description}</p>
            {children}

            {onButtonClick && (
                <button className="card-button" onClick={onButtonClick}>
                    En savoir plus
                </button>
            )}
        </div>
    </article>
  );
}