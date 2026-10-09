package managedocuments.example.managedocuments.exception;



import lombok.Getter;
import managedocuments.example.managedocuments.enums.ErrorCode;

@Getter
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
